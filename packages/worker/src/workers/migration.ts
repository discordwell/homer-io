// CSV / external-migration payloads are schema-free by nature — we normalize
// on the way in, but the intermediate shape is legitimately `any`.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Job } from 'bullmq';
import { eq, and, sql } from 'drizzle-orm';
import { createHash, createDecipheriv } from 'crypto';
import { db } from '../lib/db.js';
import { logger } from '../lib/logger.js';
import { resolveCsvAliases } from '@homer-io/shared';
import {
  migrationJobs,
  integrationDrivers,
  integrationVehicles,
  orders,
  drivers,
  vehicles,
} from '../lib/schema.js';

// Canonical vehicle types — mirrors the `vehicle_type` pgEnum in the API schema.
// Any value outside this set gets normalized to 'van' before insert.
const VEHICLE_TYPES = ['car', 'van', 'truck', 'bike', 'motorcycle', 'cargo_bike'] as const;
type VehicleType = (typeof VEHICLE_TYPES)[number];
function normalizeVehicleType(raw: string | null | undefined): VehicleType {
  if (!raw) return 'van';
  const lower = raw.toLowerCase().replace(/[\s-]+/g, '_');
  return (VEHICLE_TYPES as readonly string[]).includes(lower) ? (lower as VehicleType) : 'van';
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MigrationJobData {
  migrationJobId: string;
  tenantId: string;
}

interface ProgressCounters {
  orders: { total: number; imported: number; failed: number };
  drivers: { total: number; imported: number; failed: number };
  vehicles: { total: number; imported: number; failed: number };
}

interface ErrorLogEntry {
  entity: string;
  externalId: string;
  error: string;
  timestamp: string;
}

// ─── Crypto helpers (duplicated from API to avoid cross-package import) ──────

const MIN_ENCRYPTION_KEY_LENGTH = 32;

function deriveKey(key: string): Buffer {
  if (!key) {
    throw new Error('INTEGRATION_ENCRYPTION_KEY is required (no fallback allowed)');
  }
  if (key.length < MIN_ENCRYPTION_KEY_LENGTH) {
    throw new Error(
      `INTEGRATION_ENCRYPTION_KEY must be at least ${MIN_ENCRYPTION_KEY_LENGTH} characters (got ${key.length})`,
    );
  }
  return createHash('sha256').update(key).digest();
}

function decrypt(encrypted: string, key?: string): string {
  const encKey = key || process.env.INTEGRATION_ENCRYPTION_KEY;
  if (!encKey) {
    throw new Error('INTEGRATION_ENCRYPTION_KEY is required (no fallback allowed)');
  }
  const derivedKey = deriveKey(encKey);
  const [ivB64, authTagB64, ciphertextB64] = encrypted.split(':');
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error('Invalid encrypted data format');
  }
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const ciphertext = Buffer.from(ciphertextB64, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', derivedKey, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

// ─── API Connector types (duplicated for worker context) ─────────────────────

interface ExternalMigrationOrder {
  externalId: string;
  recipientName: string;
  recipientPhone: string | null;
  recipientEmail: string | null;
  deliveryAddress: { street: string; city: string; state: string; zip: string; country: string; lat?: number; lng?: number };
  packageCount: number;
  weight: number | null;
  notes: string | null;
  createdAt: string;
  rawData: Record<string, unknown>;
}

interface ExternalDriver {
  externalId: string;
  name: string;
  email: string | null;
  phone: string | null;
  rawData: Record<string, unknown>;
}

interface ExternalVehicle {
  externalId: string;
  name: string;
  type: string;
  licensePlate: string | null;
  rawData: Record<string, unknown>;
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ─── Duplicated platform fetch functions (same pattern as integration-sync) ──

async function fetchTookanOrders(apiKey: string, dateStart?: Date, dateEnd?: Date): Promise<ExternalMigrationOrder[]> {
  const BASE = 'https://api.tookanapp.com/v2';
  const allOrders: ExternalMigrationOrder[] = [];
  let page = 0;
  const startDate = dateStart ? dateStart.toISOString().split('T')[0] : undefined;
  const endDate = dateEnd ? dateEnd.toISOString().split('T')[0] : undefined;

  while (true) {
    const body: Record<string, unknown> = { api_key: apiKey, job_type: 0, job_status: '0,1,2,3,4,5,6,7,8,9', requested_page: page };
    if (startDate) body.start_date = startDate;
    if (endDate) body.end_date = endDate;

    const res = await fetch(`${BASE}/get_all_tasks`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`Tookan API error: ${res.status}`);
    const data = await res.json() as { status: number; data: any[]; total_page_count?: number };
    if (data.status !== 200 || !data.data?.length) break;

    for (const t of data.data) {
      allOrders.push({
        externalId: String(t.job_id || t.order_id),
        recipientName: t.customer_username || t.customer_email || 'Unknown',
        recipientPhone: t.customer_phone || null, recipientEmail: t.customer_email || null,
        deliveryAddress: { street: t.job_address || '', city: t.job_city || '', state: t.job_state || '', zip: t.job_zipcode || '', country: t.job_country || 'US', lat: t.job_latitude ? Number(t.job_latitude) : undefined, lng: t.job_longitude ? Number(t.job_longitude) : undefined },
        packageCount: t.no_of_packages ? parseInt(t.no_of_packages) || 1 : 1,
        weight: null, notes: t.job_description || null,
        createdAt: t.creation_datetime || new Date().toISOString(), rawData: t,
      });
    }
    page++;
    if (page >= (data.total_page_count ?? 1)) break;
    await sleep(100);
  }
  return allOrders;
}

async function fetchTookanDrivers(apiKey: string): Promise<ExternalDriver[]> {
  const res = await fetch('https://api.tookanapp.com/v2/get_available_agents', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: apiKey }), signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Tookan API error: ${res.status}`);
  const data = await res.json() as { status: number; data: any[] };
  if (data.status !== 200 || !data.data) return [];
  return data.data.map((a: any) => ({ externalId: String(a.fleet_id), name: a.username || a.fleet_name || 'Unknown', email: a.email || null, phone: a.phone || null, rawData: a }));
}

async function fetchOnfleetOrders(apiKey: string, dateStart?: Date, dateEnd?: Date): Promise<ExternalMigrationOrder[]> {
  const BASE = 'https://onfleet.com/api/v2';
  const auth = `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`;
  const allOrders: ExternalMigrationOrder[] = [];
  let lastId: string | undefined;

  while (true) {
    const params = new URLSearchParams();
    if (dateStart) params.set('from', String(dateStart.getTime()));
    if (dateEnd) params.set('to', String(dateEnd.getTime()));
    if (lastId) params.set('lastId', lastId);

    const res = await fetch(`${BASE}/tasks/all?${params.toString()}`, { headers: { Authorization: auth }, signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`Onfleet API error: ${res.status}`);
    const data = await res.json() as { tasks?: any[]; lastId?: string };
    const tasks = data.tasks ?? (Array.isArray(data) ? data : []);
    if (!tasks.length) break;

    for (const t of tasks) {
      const dest = t.destination || {}; const addr = dest.address || {}; const loc = dest.location || []; const recip = t.recipients?.[0] || {};
      allOrders.push({
        externalId: t.id || t.shortId, recipientName: recip.name || 'Unknown', recipientPhone: recip.phone || null, recipientEmail: null,
        deliveryAddress: { street: addr.street || addr.number ? `${addr.number || ''} ${addr.street || ''}`.trim() : '', city: addr.city || '', state: addr.state || '', zip: addr.postalCode || '', country: addr.country || 'US', lng: loc[0] || undefined, lat: loc[1] || undefined },
        packageCount: t.quantity || 1, weight: null, notes: t.notes || null,
        createdAt: t.timeCreated ? new Date(t.timeCreated).toISOString() : new Date().toISOString(), rawData: t,
      });
    }
    lastId = data.lastId;
    if (!lastId || tasks.length < 64) break;
    await sleep(50);
  }
  return allOrders;
}

async function fetchOnfleetDrivers(apiKey: string): Promise<ExternalDriver[]> {
  const auth = `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`;
  const res = await fetch('https://onfleet.com/api/v2/workers', { headers: { Authorization: auth }, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`Onfleet API error: ${res.status}`);
  const workers = await res.json() as any[];
  return workers.map((w: any) => ({ externalId: w.id, name: w.name || 'Unknown', email: w.email || null, phone: w.phone || null, rawData: w }));
}

async function fetchOnfleetVehicles(apiKey: string): Promise<ExternalVehicle[]> {
  const auth = `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`;
  const res = await fetch('https://onfleet.com/api/v2/vehicles', { headers: { Authorization: auth }, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) return [];
  const vehicles = await res.json() as any[];
  return vehicles.map((v: any) => ({ externalId: v.id, name: v.description || v.type || 'Vehicle', type: v.type || 'van', licensePlate: v.licensePlate || null, rawData: v }));
}

async function fetchOptimoRouteOrders(apiKey: string, dateStart?: Date, dateEnd?: Date): Promise<ExternalMigrationOrder[]> {
  const BASE = 'https://api.optimoroute.com/v1';
  const allOrders: ExternalMigrationOrder[] = [];
  const start = dateStart || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const end = dateEnd || new Date();
  const current = new Date(start);

  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0];
    const res = await fetch(`${BASE}/get_orders?key=${encodeURIComponent(apiKey)}&date=${dateStr}`, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`OptimoRoute API error: ${res.status}`);
    const data = await res.json() as { orders?: any[] };
    for (const o of data.orders || []) {
      const loc = o.location || {};
      allOrders.push({
        externalId: o.orderNo || o.id || `opto-${dateStr}-${allOrders.length}`,
        recipientName: loc.locationName || o.orderNo || 'Unknown', recipientPhone: loc.phone || null, recipientEmail: loc.email || null,
        deliveryAddress: { street: loc.address || '', city: loc.city || '', state: loc.state || '', zip: loc.zip || '', country: loc.country || 'US', lat: loc.latitude ? Number(loc.latitude) : undefined, lng: loc.longitude ? Number(loc.longitude) : undefined },
        packageCount: o.quantity || 1, weight: o.weight ? Number(o.weight) : null, notes: o.notes || null,
        createdAt: `${dateStr}T00:00:00Z`, rawData: o,
      });
    }
    current.setDate(current.getDate() + 1);
    await sleep(100);
  }
  return allOrders;
}

async function fetchOptimoRouteDrivers(apiKey: string): Promise<ExternalDriver[]> {
  const res = await fetch(`https://api.optimoroute.com/v1/get_drivers?key=${encodeURIComponent(apiKey)}`, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`OptimoRoute API error: ${res.status}`);
  const data = await res.json() as { drivers?: any[] };
  return (data.drivers || []).map((d: any) => ({ externalId: d.id || d.externalId || d.name, name: d.name || 'Unknown', email: d.email || null, phone: d.phone || null, rawData: d }));
}

async function fetchGetSwiftOrders(apiKey: string, dateStart?: Date, dateEnd?: Date): Promise<ExternalMigrationOrder[]> {
  const BASE = 'https://app.getswift.co/api/v2';
  const allOrders: ExternalMigrationOrder[] = [];
  let page = 1;

  while (true) {
    const params = new URLSearchParams({ page: String(page), pageSize: '100' });
    if (dateStart) params.set('fromDate', dateStart.toISOString());
    if (dateEnd) params.set('toDate', dateEnd.toISOString());

    const res = await fetch(`${BASE}/deliveries?${params.toString()}`, { headers: { 'api-key': apiKey }, signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`GetSwift API error: ${res.status}`);
    const data = await res.json() as { data?: any[]; totalPages?: number } | any[];
    const items = Array.isArray(data) ? data : data.data ?? [];
    if (!items.length) break;

    for (const d of items) {
      const dropoff = d.dropoffDetail || d.delivery || {};
      allOrders.push({
        externalId: d.id || d.reference || String(allOrders.length),
        recipientName: dropoff.name || d.customerName || 'Unknown', recipientPhone: dropoff.phone || d.customerPhone || null, recipientEmail: dropoff.email || d.customerEmail || null,
        deliveryAddress: { street: dropoff.address || '', city: dropoff.city || '', state: dropoff.state || '', zip: dropoff.postcode || dropoff.zip || '', country: dropoff.country || 'US', lat: dropoff.latitude ? Number(dropoff.latitude) : undefined, lng: dropoff.longitude ? Number(dropoff.longitude) : undefined },
        packageCount: d.itemCount || 1, weight: d.weight ? Number(d.weight) : null, notes: d.instructions || d.notes || null,
        createdAt: d.created || d.createdDate || new Date().toISOString(), rawData: d,
      });
    }
    const totalPages = Array.isArray(data) ? 1 : (data.totalPages ?? 1);
    if (page >= totalPages) break;
    page++;
    await sleep(100);
  }
  return allOrders;
}

async function fetchGetSwiftDrivers(apiKey: string): Promise<ExternalDriver[]> {
  const res = await fetch('https://app.getswift.co/api/v2/drivers', { headers: { 'api-key': apiKey }, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`GetSwift API error: ${res.status}`);
  const data = await res.json() as any[];
  return (data || []).map((d: any) => ({ externalId: d.id || d.driverId, name: d.name || `${d.firstName || ''} ${d.lastName || ''}`.trim() || 'Unknown', email: d.email || null, phone: d.phone || null, rawData: d }));
}

async function fetchCircuitOrders(apiKey: string, dateStart?: Date, dateEnd?: Date): Promise<ExternalMigrationOrder[]> {
  const BASE = 'https://api.getcircuit.com/public/v0.2b';
  const hdrs = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
  const allOrders: ExternalMigrationOrder[] = [];

  const plansRes = await fetch(`${BASE}/plans`, { headers: hdrs, signal: AbortSignal.timeout(30_000) });
  if (!plansRes.ok) throw new Error(`Circuit API error: ${plansRes.status}`);
  const plansData = await plansRes.json() as { plans?: any[] };
  const plans = (plansData.plans || []).filter((p: any) => {
    if (!dateStart && !dateEnd) return true;
    const d = p.date ? new Date(p.date) : null;
    if (!d) return true;
    if (dateStart && d < dateStart) return false;
    if (dateEnd && d > dateEnd) return false;
    return true;
  });

  for (const plan of plans) {
    const stopsRes = await fetch(`${BASE}/plans/${plan.id}/stops`, { headers: hdrs, signal: AbortSignal.timeout(30_000) });
    if (!stopsRes.ok) continue;
    const stopsData = await stopsRes.json() as { stops?: any[] };
    for (const s of stopsData.stops || []) {
      const addr = s.address || {};
      allOrders.push({
        externalId: s.id || `circuit-${plan.id}-${allOrders.length}`,
        recipientName: s.recipient?.name || s.notes || 'Unknown', recipientPhone: s.recipient?.phone || null, recipientEmail: s.recipient?.email || null,
        deliveryAddress: { street: addr.addressLineOne || addr.addressLine1 || '', city: addr.city || '', state: addr.state || '', zip: addr.zip || addr.postalCode || '', country: addr.country || 'US', lat: addr.latitude ? Number(addr.latitude) : undefined, lng: addr.longitude ? Number(addr.longitude) : undefined },
        packageCount: s.packages || s.packageCount || 1, weight: null, notes: s.notes || s.orderInfo?.note || null,
        createdAt: plan.date || new Date().toISOString(), rawData: s,
      });
    }
    await sleep(100);
  }
  return allOrders;
}

async function fetchCircuitDrivers(apiKey: string): Promise<ExternalDriver[]> {
  const res = await fetch('https://api.getcircuit.com/public/v0.2b/team/drivers', { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`Circuit API error: ${res.status}`);
  const data = await res.json() as { drivers?: any[] };
  return (data.drivers || []).map((d: any) => ({ externalId: d.id, name: d.name || d.email || 'Unknown', email: d.email || null, phone: d.phone || null, rawData: d }));
}

// ─── Platform fetch dispatcher ──────────────────────────────────────────────

async function fetchFromPlatformApi(
  platform: string, apiKey: string,
  opts: { dateStart?: Date; dateEnd?: Date; importOrders: boolean; importDrivers: boolean; importVehicles: boolean },
): Promise<{ orders: ExternalMigrationOrder[]; drivers: ExternalDriver[]; vehicles: ExternalVehicle[] }> {
  let fetchOrdersFn: ((key: string, start?: Date, end?: Date) => Promise<ExternalMigrationOrder[]>) | undefined;
  let fetchDriversFn: ((key: string) => Promise<ExternalDriver[]>) | undefined;
  let fetchVehiclesFn: ((key: string) => Promise<ExternalVehicle[]>) | undefined;

  switch (platform) {
    case 'tookan': fetchOrdersFn = fetchTookanOrders; fetchDriversFn = fetchTookanDrivers; break;
    case 'onfleet': fetchOrdersFn = fetchOnfleetOrders; fetchDriversFn = fetchOnfleetDrivers; fetchVehiclesFn = fetchOnfleetVehicles; break;
    case 'optimoroute': fetchOrdersFn = fetchOptimoRouteOrders; fetchDriversFn = fetchOptimoRouteDrivers; break;
    case 'getswift': fetchOrdersFn = fetchGetSwiftOrders; fetchDriversFn = fetchGetSwiftDrivers; break;
    case 'circuit': fetchOrdersFn = fetchCircuitOrders; fetchDriversFn = fetchCircuitDrivers; break;
    default: throw new Error(`Unsupported API platform: ${platform}`);
  }

  const [apiOrders, apiDrivers, apiVehicles] = await Promise.all([
    opts.importOrders && fetchOrdersFn ? fetchOrdersFn(apiKey, opts.dateStart, opts.dateEnd) : Promise.resolve([]),
    opts.importDrivers && fetchDriversFn ? fetchDriversFn(apiKey) : Promise.resolve([]),
    opts.importVehicles && fetchVehiclesFn ? fetchVehiclesFn(apiKey) : Promise.resolve([]),
  ]);

  return { orders: apiOrders, drivers: apiDrivers as ExternalDriver[], vehicles: apiVehicles as ExternalVehicle[] };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BATCH_SIZE = 50;
const MAX_ERROR_LOG = 100;

const log = logger.child({ worker: 'migration' });

async function updateJobProgress(jobId: string, progress: ProgressCounters, errorLog: ErrorLogEntry[]) {
  await db.update(migrationJobs).set({
    progress,
    errorLog: errorLog.slice(0, MAX_ERROR_LOG),
    updatedAt: new Date(),
  }).where(eq(migrationJobs.id, jobId));
}

async function checkCancellation(jobId: string): Promise<boolean> {
  const [job] = await db.select({ status: migrationJobs.status })
    .from(migrationJobs)
    .where(eq(migrationJobs.id, jobId))
    .limit(1);
  return job?.status === 'cancelled';
}

// ─── Batch insert helpers (shared by CSV and API paths) ─────────────────────

async function processApiOrders(
  apiOrders: ExternalMigrationOrder[], tenantId: string, platform: string,
  migrationJobId: string, progress: ProgressCounters, errorLog: ErrorLogEntry[],
) {
  // Pre-fetch existing external IDs for dedup (prevents duplicates on BullMQ retry)
  const existingExtIds = new Set<string>();
  if (apiOrders.length > 0) {
    const prefixedIds = apiOrders.map(o => `${platform}_${o.externalId}`);
    const existing = await db
      .select({ externalId: orders.externalId })
      .from(orders)
      .where(and(eq(orders.tenantId, tenantId), sql`${orders.externalId} = ANY(${prefixedIds})`));
    for (const e of existing) { if (e.externalId) existingExtIds.add(e.externalId); }
  }

  for (let i = 0; i < apiOrders.length; i += BATCH_SIZE) {
    if (await checkCancellation(migrationJobId)) return false;
    const batch = apiOrders.slice(i, i + BATCH_SIZE);
    for (const ext of batch) {
      try {
        const prefixedId = `${platform}_${ext.externalId}`;
        if (existingExtIds.has(prefixedId)) { progress.orders.imported++; continue; }
        const coords = ext.deliveryAddress.lat && ext.deliveryAddress.lng
          ? { lat: ext.deliveryAddress.lat, lng: ext.deliveryAddress.lng } : undefined;
        await db.insert(orders).values({
          tenantId,
          externalId: `${platform}_${ext.externalId}`,
          recipientName: ext.recipientName,
          recipientPhone: ext.recipientPhone,
          recipientEmail: ext.recipientEmail,
          deliveryAddress: { street: ext.deliveryAddress.street, city: ext.deliveryAddress.city, state: ext.deliveryAddress.state, zip: ext.deliveryAddress.zip, country: ext.deliveryAddress.country, ...(coords ? { coords } : {}) },
          deliveryLat: ext.deliveryAddress.lat?.toString() ?? null,
          deliveryLng: ext.deliveryAddress.lng?.toString() ?? null,
          packageCount: ext.packageCount,
          weight: ext.weight?.toString() ?? null,
          notes: ext.notes || `Migrated from ${platform}`,
        });
        progress.orders.imported++;
      } catch (err) {
        progress.orders.failed++;
        if (errorLog.length < MAX_ERROR_LOG) {
          errorLog.push({ entity: 'order', externalId: ext.externalId, error: err instanceof Error ? err.message.slice(0, 500) : 'Unknown error', timestamp: new Date().toISOString() });
        }
      }
    }
    await updateJobProgress(migrationJobId, progress, errorLog);
  }
  return true;
}

async function processApiDrivers(
  apiDrivers: ExternalDriver[], tenantId: string, platform: string,
  migrationJobId: string, progress: ProgressCounters, errorLog: ErrorLogEntry[],
) {
  // Pre-fetch existing external IDs for dedup
  const existingExtIds = new Set<string>();
  if (apiDrivers.length > 0) {
    const prefixedIds = apiDrivers.map(d => `${platform}_${d.externalId}`);
    const existing = await db
      .select({ externalId: drivers.externalId })
      .from(drivers)
      .where(and(eq(drivers.tenantId, tenantId), sql`${drivers.externalId} = ANY(${prefixedIds})`));
    for (const e of existing) { if (e.externalId) existingExtIds.add(e.externalId); }
  }

  for (let i = 0; i < apiDrivers.length; i += BATCH_SIZE) {
    if (await checkCancellation(migrationJobId)) return false;
    const batch = apiDrivers.slice(i, i + BATCH_SIZE);
    for (const ext of batch) {
      try {
        const prefixedId = `${platform}_${ext.externalId}`;
        if (existingExtIds.has(prefixedId)) { progress.drivers.imported++; continue; }
        const [newDriver] = await db.insert(drivers).values({
          tenantId, name: ext.name, email: ext.email || undefined, phone: ext.phone || undefined, externalId: `${platform}_${ext.externalId}`,
        }).returning();
        await db.insert(integrationDrivers).values({
          tenantId, migrationJobId, driverId: newDriver.id, externalDriverId: ext.externalId, platform, rawData: ext.rawData, syncStatus: 'synced',
        }).onConflictDoNothing();
        progress.drivers.imported++;
      } catch (err) {
        progress.drivers.failed++;
        if (errorLog.length < MAX_ERROR_LOG) {
          errorLog.push({ entity: 'driver', externalId: ext.externalId, error: err instanceof Error ? err.message.slice(0, 500) : 'Unknown error', timestamp: new Date().toISOString() });
        }
      }
    }
    await updateJobProgress(migrationJobId, progress, errorLog);
  }
  return true;
}

async function processApiVehicles(
  apiVehicles: ExternalVehicle[], tenantId: string, platform: string,
  migrationJobId: string, progress: ProgressCounters, errorLog: ErrorLogEntry[],
) {
  // Pre-fetch existing external IDs for dedup
  const existingExtIds = new Set<string>();
  if (apiVehicles.length > 0) {
    const prefixedIds = apiVehicles.map(v => `${platform}_${v.externalId}`);
    const existing = await db
      .select({ externalId: vehicles.externalId })
      .from(vehicles)
      .where(and(eq(vehicles.tenantId, tenantId), sql`${vehicles.externalId} = ANY(${prefixedIds})`));
    for (const e of existing) { if (e.externalId) existingExtIds.add(e.externalId); }
  }

  for (let i = 0; i < apiVehicles.length; i += BATCH_SIZE) {
    if (await checkCancellation(migrationJobId)) return false;
    const batch = apiVehicles.slice(i, i + BATCH_SIZE);
    for (const ext of batch) {
      try {
        const prefixedId = `${platform}_${ext.externalId}`;
        if (existingExtIds.has(prefixedId)) { progress.vehicles.imported++; continue; }
        const [newVehicle] = await db.insert(vehicles).values({
          tenantId, name: ext.name, type: normalizeVehicleType(ext.type), licensePlate: ext.licensePlate || undefined, externalId: `${platform}_${ext.externalId}`,
        }).returning();
        await db.insert(integrationVehicles).values({
          migrationJobId, vehicleId: newVehicle.id, externalVehicleId: ext.externalId, platform, rawData: ext.rawData, syncStatus: 'synced',
        }).onConflictDoNothing();
        progress.vehicles.imported++;
      } catch (err) {
        progress.vehicles.failed++;
        if (errorLog.length < MAX_ERROR_LOG) {
          errorLog.push({ entity: 'vehicle', externalId: ext.externalId, error: err instanceof Error ? err.message.slice(0, 500) : 'Unknown error', timestamp: new Date().toISOString() });
        }
      }
    }
    await updateJobProgress(migrationJobId, progress, errorLog);
  }
  return true;
}

// ─── Job Processor ────────────────────────────────────────────────────────────

export async function processMigration(job: Job<MigrationJobData>) {
  const { migrationJobId, tenantId } = job.data;

  log.info('Starting migration', { migrationJobId, tenantId });

  // Load job from DB
  const [migrationJob] = await db.select().from(migrationJobs)
    .where(and(eq(migrationJobs.id, migrationJobId), eq(migrationJobs.tenantId, tenantId)))
    .limit(1);

  if (!migrationJob) {
    log.error('Migration job not found', { migrationJobId });
    return;
  }

  if (migrationJob.status === 'cancelled') {
    log.info('Migration job already cancelled', { migrationJobId });
    return;
  }

  // Set status to in_progress
  await db.update(migrationJobs).set({
    status: 'in_progress',
    startedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(migrationJobs.id, migrationJobId));

  const config = migrationJob.config as Record<string, unknown>;
  const csvData = config.csvData as {
    orders?: Record<string, string>[];
    drivers?: Record<string, string>[];
    vehicles?: Record<string, string>[];
  } | undefined;
  const encryptedApiKey = config.apiKey as string | undefined;

  const progress: ProgressCounters = {
    orders: { total: csvData?.orders?.length ?? 0, imported: 0, failed: 0 },
    drivers: { total: csvData?.drivers?.length ?? 0, imported: 0, failed: 0 },
    vehicles: { total: csvData?.vehicles?.length ?? 0, imported: 0, failed: 0 },
  };
  const errorLog: ErrorLogEntry[] = [];
  const platform = migrationJob.sourcePlatform;

  try {
    // ─── API Path ──────────────────────────────────────────────────────
    if (encryptedApiKey && !csvData) {
      const apiKey = decrypt(encryptedApiKey);
      const dateStart = config.dateRangeStart ? new Date(config.dateRangeStart as string) : undefined;
      const dateEnd = config.dateRangeEnd ? new Date(config.dateRangeEnd as string) : undefined;

      log.info('Fetching from platform API', { platform, migrationJobId });
      const fetched = await fetchFromPlatformApi(platform, apiKey, {
        dateStart, dateEnd,
        importOrders: config.importOrders !== false,
        importDrivers: config.importDrivers !== false,
        importVehicles: config.importVehicles !== false,
      });

      // Update totals now that we know actual counts
      progress.orders.total = fetched.orders.length;
      progress.drivers.total = fetched.drivers.length;
      progress.vehicles.total = fetched.vehicles.length;
      await updateJobProgress(migrationJobId, progress, errorLog);

      log.info('API fetch complete, processing records', { migrationJobId, orders: fetched.orders.length, drivers: fetched.drivers.length, vehicles: fetched.vehicles.length });

      // Process orders
      if (config.importOrders !== false && fetched.orders.length > 0) {
        const ok = await processApiOrders(fetched.orders, tenantId, platform, migrationJobId, progress, errorLog);
        if (!ok) {
          await db.update(migrationJobs).set({ status: 'cancelled', updatedAt: new Date() }).where(eq(migrationJobs.id, migrationJobId));
          log.info('Migration cancelled during API order processing', { migrationJobId });
          return;
        }
      }

      // Process drivers
      if (config.importDrivers !== false && fetched.drivers.length > 0) {
        const ok = await processApiDrivers(fetched.drivers, tenantId, platform, migrationJobId, progress, errorLog);
        if (!ok) {
          await db.update(migrationJobs).set({ status: 'cancelled', updatedAt: new Date() }).where(eq(migrationJobs.id, migrationJobId));
          return;
        }
      }

      // Process vehicles
      if (config.importVehicles !== false && fetched.vehicles.length > 0) {
        const ok = await processApiVehicles(fetched.vehicles, tenantId, platform, migrationJobId, progress, errorLog);
        if (!ok) {
          await db.update(migrationJobs).set({ status: 'cancelled', updatedAt: new Date() }).where(eq(migrationJobs.id, migrationJobId));
          return;
        }
      }
    } else {
      // ─── CSV Path (existing logic) ───────────────────────────────────

      // Process Orders
      if (config.importOrders !== false && csvData?.orders?.length) {
        const orderRows = csvData.orders;
        for (let i = 0; i < orderRows.length; i += BATCH_SIZE) {
          if (await checkCancellation(migrationJobId)) {
            await db.update(migrationJobs).set({ status: 'cancelled', updatedAt: new Date() })
              .where(eq(migrationJobs.id, migrationJobId));
            log.info('Migration cancelled during order processing', { migrationJobId });
            return;
          }

          const batch = orderRows.slice(i, i + BATCH_SIZE);
          for (const row of batch) {
            try {
              const aliases = resolveCsvAliases(row);
              const coords = aliases.latitude && aliases.longitude
                ? { lat: aliases.latitude, lng: aliases.longitude }
                : undefined;

              await db.insert(orders).values({
                tenantId,
                externalId: aliases.externalId || row.external_id || row.order_id,
                recipientName: row.recipient_name || row.name || row.customer_name || 'Unknown',
                recipientPhone: row.phone || row.recipient_phone || row.customer_phone,
                recipientEmail: row.email || row.recipient_email || row.customer_email,
                deliveryAddress: {
                  street: row.street || row.address || '',
                  city: row.city || '',
                  state: row.state || '',
                  zip: row.zip || row.postal_code || '',
                  country: row.country || 'US',
                  ...(coords ? { coords } : {}),
                },
                deliveryLat: aliases.latitude?.toString() ?? null,
                deliveryLng: aliases.longitude?.toString() ?? null,
                packageCount: row.packages ? parseInt(row.packages) || 1 : 1,
                weight: aliases.weight?.toString() ?? null,
                volume: aliases.volume?.toString() ?? null,
                serviceDurationMinutes: aliases.serviceDurationMinutes,
                barcodes: aliases.barcodes,
                notes: row.notes || `Migrated from ${platform}`,
              });
              progress.orders.imported++;
            } catch (err) {
              progress.orders.failed++;
              if (errorLog.length < MAX_ERROR_LOG) {
                errorLog.push({
                  entity: 'order',
                  externalId: row.external_id || row.order_id || `row-${progress.orders.imported + progress.orders.failed}`,
                  error: err instanceof Error ? err.message.slice(0, 500) : 'Unknown error',
                  timestamp: new Date().toISOString(),
                });
              }
            }
          }
          await updateJobProgress(migrationJobId, progress, errorLog);
        }
      }

      // Process Drivers
      if (config.importDrivers !== false && csvData?.drivers?.length) {
        const driverRows = csvData.drivers;
        for (let i = 0; i < driverRows.length; i += BATCH_SIZE) {
          if (await checkCancellation(migrationJobId)) {
            await db.update(migrationJobs).set({ status: 'cancelled', updatedAt: new Date() })
              .where(eq(migrationJobs.id, migrationJobId));
            return;
          }

          const batch = driverRows.slice(i, i + BATCH_SIZE);
          for (const row of batch) {
            try {
              const extId = row.external_id || row.driver_id || row.id || '';
              const [newDriver] = await db.insert(drivers).values({
                tenantId,
                name: row.name || row.driver_name || 'Unknown Driver',
                email: row.email || row.driver_email || undefined,
                phone: row.phone || row.driver_phone || undefined,
                externalId: extId || undefined,
              }).returning();

              await db.insert(integrationDrivers).values({
                tenantId,
                migrationJobId,
                driverId: newDriver.id,
                externalDriverId: extId || newDriver.id,
                platform,
                rawData: row,
                syncStatus: 'synced',
              }).onConflictDoNothing();

              progress.drivers.imported++;
            } catch (err) {
              progress.drivers.failed++;
              if (errorLog.length < MAX_ERROR_LOG) {
                errorLog.push({
                  entity: 'driver',
                  externalId: row.external_id || row.driver_id || `row-${progress.drivers.imported + progress.drivers.failed}`,
                  error: err instanceof Error ? err.message.slice(0, 500) : 'Unknown error',
                  timestamp: new Date().toISOString(),
                });
              }
            }
          }
          await updateJobProgress(migrationJobId, progress, errorLog);
        }
      }

      // Process Vehicles
      if (config.importVehicles !== false && csvData?.vehicles?.length) {
        const vehicleRows = csvData.vehicles;
        for (let i = 0; i < vehicleRows.length; i += BATCH_SIZE) {
          if (await checkCancellation(migrationJobId)) {
            await db.update(migrationJobs).set({ status: 'cancelled', updatedAt: new Date() })
              .where(eq(migrationJobs.id, migrationJobId));
            return;
          }

          const batch = vehicleRows.slice(i, i + BATCH_SIZE);
          for (const row of batch) {
            try {
              const extId = row.external_id || row.vehicle_id || row.id || '';
              const vehicleType = normalizeVehicleType(row.type || row.vehicle_type);
              const [newVehicle] = await db.insert(vehicles).values({
                tenantId,
                name: row.name || row.vehicle_name || 'Unknown Vehicle',
                type: vehicleType,
                licensePlate: row.license_plate || row.plate || undefined,
                externalId: extId || undefined,
              }).returning();

              await db.insert(integrationVehicles).values({
                migrationJobId,
                vehicleId: newVehicle.id,
                externalVehicleId: extId || newVehicle.id,
                platform,
                rawData: row,
                syncStatus: 'synced',
              }).onConflictDoNothing();

              progress.vehicles.imported++;
            } catch (err) {
              progress.vehicles.failed++;
              if (errorLog.length < MAX_ERROR_LOG) {
                errorLog.push({
                  entity: 'vehicle',
                  externalId: row.external_id || row.vehicle_id || `row-${progress.vehicles.imported + progress.vehicles.failed}`,
                  error: err instanceof Error ? err.message.slice(0, 500) : 'Unknown error',
                  timestamp: new Date().toISOString(),
                });
              }
            }
          }
          await updateJobProgress(migrationJobId, progress, errorLog);
        }
      }
    }

    // ─── Complete ───────────────────────────────────────────────────────
    await db.update(migrationJobs).set({
      status: 'completed',
      completedAt: new Date(),
      progress,
      errorLog: errorLog.slice(0, MAX_ERROR_LOG),
      updatedAt: new Date(),
    }).where(eq(migrationJobs.id, migrationJobId));

    log.info('Migration completed', {
      migrationJobId,
      orders: progress.orders,
      drivers: progress.drivers,
      vehicles: progress.vehicles,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown migration error';
    log.error('Migration failed', { migrationJobId, error: errorMsg });

    await db.update(migrationJobs).set({
      status: 'failed',
      completedAt: new Date(),
      progress,
      errorLog: errorLog.slice(0, MAX_ERROR_LOG),
      updatedAt: new Date(),
    }).where(eq(migrationJobs.id, migrationJobId));

    throw err; // Let BullMQ handle retries
  }
}
