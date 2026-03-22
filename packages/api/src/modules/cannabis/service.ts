import { eq, sql, desc } from 'drizzle-orm';
import type { CannabisSettings, UpdateCannabisSettingsInput, CreateManifestInput } from '@homer-io/shared';
import { cannabisSettingsSchema } from '@homer-io/shared';
import { db } from '../../lib/db/index.js';
import { tenants } from '../../lib/db/schema/tenants.js';
import { deliveryManifests } from '../../lib/db/schema/delivery-manifests.js';
import { routes } from '../../lib/db/schema/routes.js';
import { drivers } from '../../lib/db/schema/drivers.js';
import { vehicles } from '../../lib/db/schema/vehicles.js';
import { logActivity } from '../../lib/activity.js';
import { generateManifestPdf } from '../reports/cannabis-manifest.js';

// ---------------------------------------------------------------------------
// Industry gating
// ---------------------------------------------------------------------------

export async function getTenantIndustry(tenantId: string): Promise<string | null> {
  const [row] = await db.select({ industry: tenants.industry })
    .from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  return row?.industry ?? null;
}

export async function requireCannabisIndustry(tenantId: string): Promise<void> {
  const industry = await getTenantIndustry(tenantId);
  if (industry !== 'cannabis') {
    throw Object.assign(new Error('This feature requires the cannabis industry'), { statusCode: 403 });
  }
}

// ---------------------------------------------------------------------------
// Cannabis settings
// ---------------------------------------------------------------------------

export async function getCannabisSettings(tenantId: string): Promise<CannabisSettings | null> {
  const [row] = await db.select({ settings: tenants.settings })
    .from(tenants).where(eq(tenants.id, tenantId)).limit(1);

  const settings = (row?.settings ?? {}) as Record<string, unknown>;
  const cannabis = settings.cannabis;
  if (!cannabis) return null;

  const parsed = cannabisSettingsSchema.safeParse(cannabis);
  return parsed.success ? parsed.data : null;
}

export async function updateCannabisSettings(
  tenantId: string,
  input: UpdateCannabisSettingsInput,
  userId?: string,
): Promise<CannabisSettings> {
  const [row] = await db.select({ settings: tenants.settings })
    .from(tenants).where(eq(tenants.id, tenantId)).limit(1);

  const settings = (row?.settings ?? {}) as Record<string, unknown>;
  const existing = (settings.cannabis ?? {}) as Record<string, unknown>;
  const merged = { ...existing, ...input };

  await db.update(tenants).set({
    settings: { ...settings, cannabis: merged },
    updatedAt: new Date(),
  }).where(eq(tenants.id, tenantId));

  if (userId) {
    await logActivity({
      tenantId,
      userId,
      action: 'update',
      entityType: 'cannabis_settings',
      entityId: tenantId,
      metadata: input as Record<string, unknown>,
    });
  }

  return cannabisSettingsSchema.parse(merged);
}

// ---------------------------------------------------------------------------
// Manifest number generation
// ---------------------------------------------------------------------------

export async function generateManifestNumber(tenantId: string): Promise<string> {
  const settings = await getCannabisSettings(tenantId);
  const prefix = settings?.manifestPrefix ?? 'MAN';

  const [last] = await db.select({ manifestNumber: deliveryManifests.manifestNumber })
    .from(deliveryManifests)
    .where(eq(deliveryManifests.tenantId, tenantId))
    .orderBy(desc(deliveryManifests.createdAt))
    .limit(1);

  let nextNum = 1;
  if (last?.manifestNumber) {
    const match = last.manifestNumber.match(/(\d+)$/);
    if (match) nextNum = parseInt(match[1], 10) + 1;
  }

  return `${prefix}-${String(nextNum).padStart(5, '0')}`;
}

// ---------------------------------------------------------------------------
// Manifest CRUD
// ---------------------------------------------------------------------------

export async function createManifest(
  tenantId: string,
  input: CreateManifestInput,
  userId?: string,
) {
  let manifestNumber = await generateManifestNumber(tenantId);
  const settings = await getCannabisSettings(tenantId);

  // Fetch route details for driver/vehicle info (tenant-isolated)
  const [route] = await db.select({
    driverId: routes.driverId,
    vehicleId: routes.vehicleId,
  }).from(routes).where(sql`${routes.id} = ${input.routeId} AND ${routes.tenantId} = ${tenantId}`).limit(1);

  if (!route) {
    throw Object.assign(new Error('Route not found'), { statusCode: 404 });
  }

  let driverLicenseNumber: string | null = null;
  let vehicleLicensePlate: string | null = null;

  if (route?.driverId) {
    const [driver] = await db.select({ licenseNumber: drivers.licenseNumber })
      .from(drivers).where(eq(drivers.id, route.driverId)).limit(1);
    driverLicenseNumber = driver?.licenseNumber ?? null;
  }

  if (route?.vehicleId) {
    const [vehicle] = await db.select({ licensePlate: vehicles.licensePlate })
      .from(vehicles).where(eq(vehicles.id, route.vehicleId)).limit(1);
    vehicleLicensePlate = vehicle?.licensePlate ?? null;
  }

  // Calculate totals
  let totalItems = 0;
  let totalValue = 0;
  let totalWeight = 0;
  for (const item of input.items) {
    for (const product of item.products) {
      totalItems += product.quantity;
      totalValue += (product.price ?? 0) * product.quantity;
      totalWeight += (product.weight ?? 0) * product.quantity;
    }
  }

  // Insert with retry on unique constraint violation (concurrent manifest creation)
  let manifest;
  let retries = 3;
  while (retries > 0) {
    try {
      const [row] = await db.insert(deliveryManifests).values({
        tenantId,
        routeId: input.routeId,
        driverId: route.driverId ?? null,
        vehicleId: route.vehicleId ?? null,
        manifestNumber,
        status: 'draft',
        licenseNumber: settings?.licenseNumber ?? null,
        driverLicenseNumber,
        vehicleLicensePlate,
        totalItems,
        totalValue: String(Math.round(totalValue * 100) / 100),
        totalWeight: String(Math.round(totalWeight * 100) / 100),
        items: input.items,
        notes: input.notes ?? null,
      }).returning();
      manifest = row;
      break;
    } catch (err: any) {
      if ((err?.code === '23505' || err?.message?.includes('duplicate')) && retries > 1) {
        retries--;
        manifestNumber = await generateManifestNumber(tenantId);
        continue;
      }
      throw err;
    }
  }
  if (!manifest) throw new Error('Failed to create manifest after retries');

  // Generate PDF
  try {
    const pdfUrl = await generateManifestPdf(tenantId, manifest);
    await db.update(deliveryManifests).set({ pdfUrl }).where(eq(deliveryManifests.id, manifest.id));
    manifest.pdfUrl = pdfUrl;
  } catch (err) {
    console.error('[cannabis] Manifest PDF generation failed:', err);
  }

  if (userId) {
    await logActivity({
      tenantId,
      userId,
      action: 'create',
      entityType: 'delivery_manifest',
      entityId: manifest.id,
      metadata: { manifestNumber, routeId: input.routeId },
    });
  }

  return manifest;
}

export async function getManifest(tenantId: string, manifestId: string) {
  const [manifest] = await db.select()
    .from(deliveryManifests)
    .where(eq(deliveryManifests.id, manifestId))
    .limit(1);

  if (!manifest || manifest.tenantId !== tenantId) return null;
  return manifest;
}

export async function listManifests(
  tenantId: string,
  options: { limit?: number; offset?: number; routeId?: string } = {},
) {
  const { limit = 50, offset = 0, routeId } = options;

  let query = db.select()
    .from(deliveryManifests)
    .where(eq(deliveryManifests.tenantId, tenantId))
    .orderBy(desc(deliveryManifests.createdAt))
    .limit(limit)
    .offset(offset);

  if (routeId) {
    query = db.select()
      .from(deliveryManifests)
      .where(sql`${deliveryManifests.tenantId} = ${tenantId} AND ${deliveryManifests.routeId} = ${routeId}`)
      .orderBy(desc(deliveryManifests.createdAt))
      .limit(limit)
      .offset(offset);
  }

  return query;
}

export async function completeManifest(tenantId: string, manifestId: string, userId?: string) {
  // Guard: only active manifests can be completed
  const [current] = await db.select({ status: deliveryManifests.status })
    .from(deliveryManifests).where(sql`${deliveryManifests.id} = ${manifestId} AND ${deliveryManifests.tenantId} = ${tenantId}`).limit(1);
  if (!current) return null;
  if (current.status !== 'active') {
    throw Object.assign(new Error(`Cannot complete a ${current.status} manifest — must be active`), { statusCode: 422 });
  }

  const [updated] = await db.update(deliveryManifests)
    .set({ status: 'completed', returnedAt: new Date(), updatedAt: new Date() })
    .where(sql`${deliveryManifests.id} = ${manifestId} AND ${deliveryManifests.tenantId} = ${tenantId}`)
    .returning();

  if (userId && updated) {
    await logActivity({
      tenantId,
      userId,
      action: 'update',
      entityType: 'delivery_manifest',
      entityId: manifestId,
      metadata: { status: 'completed' },
    });
  }

  return updated ?? null;
}

export async function voidManifest(tenantId: string, manifestId: string, userId?: string) {
  // Guard: only draft or active manifests can be voided
  const [current] = await db.select({ status: deliveryManifests.status })
    .from(deliveryManifests).where(sql`${deliveryManifests.id} = ${manifestId} AND ${deliveryManifests.tenantId} = ${tenantId}`).limit(1);
  if (!current) return null;
  if (current.status !== 'draft' && current.status !== 'active') {
    throw Object.assign(new Error(`Cannot void a ${current.status} manifest`), { statusCode: 422 });
  }

  const [updated] = await db.update(deliveryManifests)
    .set({ status: 'voided', updatedAt: new Date() })
    .where(sql`${deliveryManifests.id} = ${manifestId} AND ${deliveryManifests.tenantId} = ${tenantId}`)
    .returning();

  if (userId && updated) {
    await logActivity({
      tenantId,
      userId,
      action: 'update',
      entityType: 'delivery_manifest',
      entityId: manifestId,
      metadata: { status: 'voided' },
    });
  }

  return updated ?? null;
}

export async function activateManifest(tenantId: string, manifestId: string, userId?: string) {
  // Guard: only draft manifests can be activated
  const [current] = await db.select({ status: deliveryManifests.status })
    .from(deliveryManifests).where(sql`${deliveryManifests.id} = ${manifestId} AND ${deliveryManifests.tenantId} = ${tenantId}`).limit(1);
  if (!current) return null;
  if (current.status !== 'draft') {
    throw Object.assign(new Error(`Cannot activate a ${current.status} manifest — must be draft`), { statusCode: 422 });
  }

  const [updated] = await db.update(deliveryManifests)
    .set({ status: 'active', departedAt: new Date(), updatedAt: new Date() })
    .where(sql`${deliveryManifests.id} = ${manifestId} AND ${deliveryManifests.tenantId} = ${tenantId}`)
    .returning();

  if (userId && updated) {
    await logActivity({
      tenantId,
      userId,
      action: 'update',
      entityType: 'delivery_manifest',
      entityId: manifestId,
      metadata: { status: 'active' },
    });
  }

  return updated ?? null;
}

// ---------------------------------------------------------------------------
// ID verification helpers
// ---------------------------------------------------------------------------

/** Check if a person meets the minimum age requirement */
export function verifyAge(dob: string, minimumAge: number): { verified: boolean; age: number } {
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return { verified: age >= minimumAge, age };
}

/** Fuzzy name match — checks if names are similar enough (case-insensitive, word-order-independent) */
export function validateIdMatch(idName: string, recipientName: string): { match: boolean; confidence: number } {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z\s]/g, '').trim().split(/\s+/).sort().join(' ');
  const a = normalize(idName);
  const b = normalize(recipientName);

  if (a === b) return { match: true, confidence: 1.0 };

  // Check if all words in one name appear in the other
  const wordsA = a.split(' ');
  const wordsB = b.split(' ');
  const matchingWords = wordsA.filter(w => wordsB.includes(w)).length;
  const totalWords = Math.max(wordsA.length, wordsB.length);
  const confidence = matchingWords / totalWords;

  return { match: confidence >= 0.5, confidence };
}
