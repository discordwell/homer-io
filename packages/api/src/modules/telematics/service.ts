import { and, eq, sql } from 'drizzle-orm';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { db } from '../../lib/db/index.js';
import { telematicsConnections } from '../../lib/db/schema/telematics-connections.js';
import { telematicsExternalVehicles } from '../../lib/db/schema/telematics-external-vehicles.js';
import { telematicsSyncState } from '../../lib/db/schema/telematics-sync-state.js';
import { telematicsPositions } from '../../lib/db/schema/telematics-positions.js';
import { vehicles } from '../../lib/db/schema/vehicles.js';
import { drivers } from '../../lib/db/schema/drivers.js';
import { encrypt, decrypt } from '../../lib/integrations/crypto.js';
import {
  getTelematicsAdapter,
  listTelematicsAdapters,
  type TelematicsProvider,
  type AuthMaterial,
  type NormalizedVehicle,
  type NormalizedPosition,
  type NormalizedEvent,
} from '../../lib/telematics/index.js';
import { config } from '../../config.js';
import { logger } from '../../lib/logger.js';
import { mergePosition, type LocationSource } from '../tracking/service.js';
import { NotFoundError, BadRequestError } from '../../lib/errors.js';

// ── OAuth state ──────────────────────────────────────────────────────────────
// Signed state param, so we don't need a DB table for in-flight OAuth sessions.
// Format: base64url(json({tid,prov,ts,nonce})):hmac

function stateSecret(): Buffer {
  return Buffer.from(config.jwt.secret);
}

export function signState(tenantId: string, provider: TelematicsProvider): string {
  const payload = { tid: tenantId, prov: provider, ts: Date.now(), nonce: randomBytes(8).toString('hex') };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', stateSecret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyState(state: string): { tenantId: string; provider: TelematicsProvider } {
  const [body, sig] = state.split('.');
  if (!body || !sig) throw new BadRequestError('Invalid state');
  const expected = createHmac('sha256', stateSecret()).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new BadRequestError('Invalid state signature');
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as {
    tid: string; prov: TelematicsProvider; ts: number; nonce: string;
  };
  if (Date.now() - payload.ts > 15 * 60 * 1000) throw new BadRequestError('State expired');
  return { tenantId: payload.tid, provider: payload.prov };
}

// ── Auth material crypto ─────────────────────────────────────────────────────

function encryptAuth(auth: AuthMaterial): { ciphertext: string } {
  return { ciphertext: encrypt(JSON.stringify(auth)) };
}

function decryptAuth(stored: unknown): AuthMaterial {
  if (!stored || typeof stored !== 'object' || !('ciphertext' in stored)) {
    throw new Error('Invalid stored auth_material');
  }
  return JSON.parse(decrypt((stored as { ciphertext: string }).ciphertext)) as AuthMaterial;
}

// ── Provider catalog ─────────────────────────────────────────────────────────

export function listAvailableProviders() {
  return listTelematicsAdapters().map(a => ({
    provider: a.provider,
    name: a.displayName,
    description: a.description,
    authKind: a.authKind,
  }));
}

// ── Connect flow ─────────────────────────────────────────────────────────────

export async function startConnect(tenantId: string, provider: TelematicsProvider, redirectUri: string) {
  const adapter = getTelematicsAdapter(provider);
  const state = signState(tenantId, provider);
  const result = await adapter.startAuth({ tenantId, redirectUri, state });
  if (result.kind === 'oauth') {
    return { kind: 'oauth' as const, redirectUrl: result.redirectUrl, state };
  }
  return { kind: 'api_key' as const, fields: result.fields, state };
}

export async function completeConnect(args: {
  tenantId: string;
  provider: TelematicsProvider;
  state: string;
  code?: string;
  redirectUri?: string;
  credentials?: Record<string, string>;
}): Promise<{ connectionId: string }> {
  const { tenantId, provider } = args;
  const verified = verifyState(args.state);
  if (verified.tenantId !== tenantId || verified.provider !== provider) {
    throw new BadRequestError('State tenant/provider mismatch');
  }
  const adapter = getTelematicsAdapter(provider);

  const input = args.code
    ? { code: args.code, redirectUri: args.redirectUri ?? '' }
    : { credentials: args.credentials ?? {} };

  const { authMaterial, externalOrgId, accountName, refreshTokenExpiresAt } = await adapter.completeAuth(
    { tenantId, redirectUri: args.redirectUri ?? '', state: args.state },
    input,
  );

  // If a connection for (tenant, provider) already exists, update it (reconnect).
  const existing = await db.select().from(telematicsConnections)
    .where(and(eq(telematicsConnections.tenantId, tenantId), eq(telematicsConnections.provider, provider)))
    .limit(1);

  let connectionId: string;
  if (existing[0]) {
    await db.update(telematicsConnections)
      .set({
        authMaterial: encryptAuth(authMaterial),
        refreshTokenExpiresAt,
        externalOrgId,
        accountName,
        status: 'active',
        disabledReason: null,
        updatedAt: new Date(),
      })
      .where(eq(telematicsConnections.id, existing[0].id));
    connectionId = existing[0].id;
  } else {
    const [row] = await db.insert(telematicsConnections).values({
      tenantId,
      provider,
      authMaterial: encryptAuth(authMaterial),
      refreshTokenExpiresAt,
      externalOrgId,
      accountName,
      status: 'active',
    }).returning({ id: telematicsConnections.id });
    connectionId = row.id;
  }

  // Register webhook (best-effort) and seed sync-state rows.
  if (adapter.registerWebhook) {
    try {
      const callbackUrl = `${config.app.apiUrl}/api/telematics/webhooks/${provider}/${connectionId}`;
      const reg = await adapter.registerWebhook(authMaterial, callbackUrl);
      await db.update(telematicsConnections)
        .set({ webhookId: reg.webhookId, webhookSecret: reg.signingSecret, updatedAt: new Date() })
        .where(eq(telematicsConnections.id, connectionId));
    } catch (err) {
      logger.warn({ err, connectionId }, '[telematics] webhook register failed, will rely on polling');
    }
  }

  // Seed sync state for the domains the adapter supports.
  const probe = await adapter.probe(authMaterial).catch(() => ({ vehicles: false, drivers: false, positions: false }));
  const domains: Array<'vehicles' | 'drivers' | 'positions'> = [];
  if (probe.vehicles) domains.push('vehicles');
  if (probe.drivers) domains.push('drivers');
  if (probe.positions) domains.push('positions');
  for (const domain of domains) {
    // On reconnect, poke nextDueAt so the scheduler picks up changed scopes
    // immediately rather than waiting for the prior cadence window.
    await db.insert(telematicsSyncState).values({ connectionId, domain, nextDueAt: new Date() })
      .onConflictDoUpdate({
        target: [telematicsSyncState.connectionId, telematicsSyncState.domain],
        set: { nextDueAt: new Date(), lastError: null },
      });
  }

  // Kick off an initial vehicle list + position fetch (fire-and-forget).
  runInitialSync(connectionId).catch(err =>
    logger.error({ err, connectionId }, '[telematics] initial sync failed'),
  );

  return { connectionId };
}

async function runInitialSync(connectionId: string): Promise<void> {
  const conn = await fetchConnectionById(connectionId);
  if (!conn) return;
  const adapter = getTelematicsAdapter(conn.provider);
  const auth = decryptAuth(conn.authMaterial);

  if (adapter.listVehicles) {
    let cursor: string | undefined;
    do {
      const page = await adapter.listVehicles(auth, cursor);
      for (const v of page.items) await upsertExternalVehicle(connectionId, v);
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
  }

  if (adapter.fetchLatestPositions) {
    const positions = await adapter.fetchLatestPositions(auth);
    for (const p of positions) await ingestPosition(connectionId, conn.tenantId, p, conn.provider);
  }

  await db.update(telematicsConnections)
    .set({ lastSyncAt: new Date(), updatedAt: new Date() })
    .where(eq(telematicsConnections.id, connectionId));
}

async function fetchConnectionById(connectionId: string) {
  const [row] = await db.select().from(telematicsConnections)
    .where(eq(telematicsConnections.id, connectionId)).limit(1);
  return row ?? null;
}

async function upsertExternalVehicle(connectionId: string, v: NormalizedVehicle): Promise<void> {
  await db.insert(telematicsExternalVehicles).values({
    connectionId,
    externalVehicleId: v.externalVehicleId,
    vin: v.vin,
    plate: v.plate,
    name: v.name,
    make: v.make,
    model: v.model,
    year: v.year,
    rawJson: v.raw as object,
  }).onConflictDoUpdate({
    target: [telematicsExternalVehicles.connectionId, telematicsExternalVehicles.externalVehicleId],
    set: {
      vin: v.vin, plate: v.plate, name: v.name, make: v.make, model: v.model, year: v.year,
      rawJson: v.raw as object, lastSeenAt: new Date(),
    },
  });
}

// ── Connection read/write ────────────────────────────────────────────────────

export async function listConnections(tenantId: string) {
  const rows = await db.select({
    id: telematicsConnections.id,
    provider: telematicsConnections.provider,
    accountName: telematicsConnections.accountName,
    status: telematicsConnections.status,
    disabledReason: telematicsConnections.disabledReason,
    lastSyncAt: telematicsConnections.lastSyncAt,
    createdAt: telematicsConnections.createdAt,
  }).from(telematicsConnections)
    .where(eq(telematicsConnections.tenantId, tenantId));
  return rows;
}

export async function getConnection(tenantId: string, connectionId: string) {
  const [row] = await db.select({
    id: telematicsConnections.id,
    provider: telematicsConnections.provider,
    accountName: telematicsConnections.accountName,
    status: telematicsConnections.status,
    disabledReason: telematicsConnections.disabledReason,
    lastSyncAt: telematicsConnections.lastSyncAt,
    createdAt: telematicsConnections.createdAt,
  }).from(telematicsConnections)
    .where(and(eq(telematicsConnections.id, connectionId), eq(telematicsConnections.tenantId, tenantId)))
    .limit(1);
  if (!row) throw new NotFoundError('Connection not found');
  const [vehicleStats] = await db.select({
    total: sql<number>`count(*)::int`,
    mapped: sql<number>`count(*) filter (where ${telematicsExternalVehicles.mappedVehicleId} is not null)::int`,
  }).from(telematicsExternalVehicles)
    .where(eq(telematicsExternalVehicles.connectionId, connectionId));
  return { ...row, vehicleCount: vehicleStats?.total ?? 0, mappedVehicleCount: vehicleStats?.mapped ?? 0 };
}

export async function disconnect(tenantId: string, connectionId: string): Promise<void> {
  const [row] = await db.select().from(telematicsConnections)
    .where(and(eq(telematicsConnections.id, connectionId), eq(telematicsConnections.tenantId, tenantId)))
    .limit(1);
  if (!row) throw new NotFoundError('Connection not found');
  // Best-effort deregister webhook upstream.
  try {
    const adapter = getTelematicsAdapter(row.provider);
    if (adapter.deregisterWebhook && row.webhookId) {
      const auth = decryptAuth(row.authMaterial);
      await adapter.deregisterWebhook(auth, row.webhookId);
    }
  } catch (err) {
    logger.warn({ err, connectionId }, '[telematics] webhook deregister failed; deleting locally anyway');
  }
  await db.delete(telematicsConnections).where(eq(telematicsConnections.id, connectionId));
}

// ── Vehicle linking ──────────────────────────────────────────────────────────

function normalizePlate(plate: string | null | undefined): string | null {
  if (!plate) return null;
  return plate.replace(/[^A-Za-z0-9]/g, '').toUpperCase() || null;
}

export async function listExternalVehiclesWithSuggestions(tenantId: string, connectionId: string) {
  const [conn] = await db.select().from(telematicsConnections)
    .where(and(eq(telematicsConnections.id, connectionId), eq(telematicsConnections.tenantId, tenantId)))
    .limit(1);
  if (!conn) throw new NotFoundError('Connection not found');

  const [externalVehicles, homerVehicles] = await Promise.all([
    db.select().from(telematicsExternalVehicles).where(eq(telematicsExternalVehicles.connectionId, connectionId)),
    db.select({
      id: vehicles.id, name: vehicles.name, licensePlate: vehicles.licensePlate, type: vehicles.type,
    }).from(vehicles).where(eq(vehicles.tenantId, tenantId)),
  ]);

  // Build a plate index for fast auto-suggest lookup.
  const plateIndex = new Map<string, { id: string; name: string }>();
  for (const hv of homerVehicles) {
    const norm = normalizePlate(hv.licensePlate);
    if (norm) plateIndex.set(norm, { id: hv.id, name: hv.name });
  }

  return externalVehicles.map(ev => {
    const plateNorm = normalizePlate(ev.plate);
    const suggestion = plateNorm ? plateIndex.get(plateNorm) : undefined;
    return {
      id: ev.id,
      externalVehicleId: ev.externalVehicleId,
      name: ev.name,
      vin: ev.vin,
      plate: ev.plate,
      make: ev.make,
      model: ev.model,
      year: ev.year,
      mappedVehicleId: ev.mappedVehicleId,
      suggestion: suggestion ? { vehicleId: suggestion.id, vehicleName: suggestion.name, reason: 'plate_match' as const } : null,
    };
  });
}

export async function linkExternalVehicle(tenantId: string, connectionId: string, externalVehicleId: string, homerVehicleId: string | null): Promise<void> {
  // Verify both belong to this tenant/connection.
  const [conn] = await db.select().from(telematicsConnections)
    .where(and(eq(telematicsConnections.id, connectionId), eq(telematicsConnections.tenantId, tenantId)))
    .limit(1);
  if (!conn) throw new NotFoundError('Connection not found');

  if (homerVehicleId) {
    const [hv] = await db.select({ id: vehicles.id }).from(vehicles)
      .where(and(eq(vehicles.id, homerVehicleId), eq(vehicles.tenantId, tenantId)))
      .limit(1);
    if (!hv) throw new NotFoundError('Homer vehicle not found');
  }

  await db.update(telematicsExternalVehicles)
    .set({ mappedVehicleId: homerVehicleId })
    .where(and(
      eq(telematicsExternalVehicles.connectionId, connectionId),
      eq(telematicsExternalVehicles.externalVehicleId, externalVehicleId),
    ));
}

// ── Webhook ingest ───────────────────────────────────────────────────────────

export async function ingestWebhook(
  provider: TelematicsProvider,
  connectionId: string,
  rawBody: string,
  headers: Record<string, string | undefined>,
): Promise<{ accepted: number }> {
  const [conn] = await db.select().from(telematicsConnections)
    .where(eq(telematicsConnections.id, connectionId))
    .limit(1);
  if (!conn || conn.provider !== provider) throw new NotFoundError('Connection not found');

  const adapter = getTelematicsAdapter(provider);
  const secret = conn.webhookSecret
    ?? config.telematics?.[provider]?.webhookSigningSecret
    ?? '';

  if (!adapter.verifyWebhook || !adapter.parseWebhook) {
    throw new BadRequestError(`${provider} does not support webhooks`);
  }
  if (!secret) throw new BadRequestError('webhook secret not configured');
  if (!adapter.verifyWebhook(headers, rawBody, secret)) {
    throw new BadRequestError('Invalid webhook signature');
  }

  const events = adapter.parseWebhook(rawBody);
  let accepted = 0;
  for (const ev of events) {
    if (ev.kind === 'position') {
      await ingestPosition(connectionId, conn.tenantId, ev.position, provider);
      accepted += 1;
    } else if (ev.kind === 'vehicle_upsert') {
      await upsertExternalVehicle(connectionId, ev.vehicle);
      accepted += 1;
    }
    // driver_upsert handled in P2+
  }
  await db.update(telematicsConnections)
    .set({ lastSyncAt: new Date(), updatedAt: new Date() })
    .where(eq(telematicsConnections.id, connectionId));
  return { accepted };
}

async function ingestPosition(
  connectionId: string,
  tenantId: string,
  p: NormalizedPosition,
  provider: TelematicsProvider,
): Promise<void> {
  // 1. Raw buffer for history / debug.
  await db.insert(telematicsPositions).values({
    connectionId,
    externalVehicleId: p.externalVehicleId,
    lat: p.lat.toString(),
    lng: p.lng.toString(),
    speed: p.speed?.toString() ?? null,
    heading: p.heading ?? null,
    recordedAt: p.recordedAt,
  });

  // 2. Resolve the external vehicle → Homer vehicle → assigned driver.
  const [ev] = await db.select({ mappedVehicleId: telematicsExternalVehicles.mappedVehicleId })
    .from(telematicsExternalVehicles)
    .where(and(
      eq(telematicsExternalVehicles.connectionId, connectionId),
      eq(telematicsExternalVehicles.externalVehicleId, p.externalVehicleId),
    ))
    .limit(1);
  const mappedVehicleId = ev?.mappedVehicleId ?? null;
  if (!mappedVehicleId) return; // Unlinked vehicle → write to telematics_positions only.

  // Find a driver assigned to this vehicle. Prefer drivers.currentVehicleId.
  const [driverRow] = await db.select({ id: drivers.id })
    .from(drivers)
    .where(and(eq(drivers.tenantId, tenantId), eq(drivers.currentVehicleId, mappedVehicleId)))
    .limit(1);

  await mergePosition({
    tenantId,
    driverId: driverRow?.id ?? null,
    vehicleId: mappedVehicleId,
    source: provider as LocationSource,
    lat: p.lat,
    lng: p.lng,
    speed: p.speed,
    heading: p.heading,
    recordedAt: p.recordedAt,
  });
}

// Re-exported so the poll scheduler can call it.
export { runInitialSync };
