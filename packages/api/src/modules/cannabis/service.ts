import { eq, sql, desc, and } from 'drizzle-orm';
import type { CannabisSettings, UpdateCannabisSettingsInput, CreateManifestInput, CreateDriverKitInput, ReconcileKitInput } from '@homer-io/shared';
import { cannabisSettingsSchema } from '@homer-io/shared';
import { db } from '../../lib/db/index.js';
import { tenants } from '../../lib/db/schema/tenants.js';
import { deliveryManifests } from '../../lib/db/schema/delivery-manifests.js';
import { driverKits } from '../../lib/db/schema/driver-kits.js';
import { orders } from '../../lib/db/schema/orders.js';
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

// ---------------------------------------------------------------------------
// Driver kits (inventory management)
// ---------------------------------------------------------------------------

export async function createDriverKit(
  tenantId: string,
  input: CreateDriverKitInput,
  userId?: string,
) {
  // Verify route belongs to tenant
  const [route] = await db.select({ driverId: routes.driverId })
    .from(routes).where(sql`${routes.id} = ${input.routeId} AND ${routes.tenantId} = ${tenantId}`).limit(1);
  if (!route) throw Object.assign(new Error('Route not found'), { statusCode: 404 });

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

  const [kit] = await db.insert(driverKits).values({
    tenantId,
    routeId: input.routeId,
    driverId: route.driverId,
    manifestId: input.manifestId ?? null,
    status: 'loading',
    totalItemsLoaded: totalItems,
    totalValueLoaded: String(Math.round(totalValue * 100) / 100),
    totalWeightLoaded: String(Math.round(totalWeight * 100) / 100),
    items: input.items,
    notes: input.notes ?? null,
  }).returning();

  if (userId) {
    await logActivity({
      tenantId, userId, action: 'create',
      entityType: 'driver_kit', entityId: kit.id,
      metadata: { routeId: input.routeId, totalItems, totalValue },
    });
  }

  return kit;
}

export async function getDriverKit(tenantId: string, kitId: string) {
  const [kit] = await db.select().from(driverKits)
    .where(sql`${driverKits.id} = ${kitId} AND ${driverKits.tenantId} = ${tenantId}`)
    .limit(1);
  return kit ?? null;
}

export async function getKitByRoute(tenantId: string, routeId: string) {
  const [kit] = await db.select().from(driverKits)
    .where(sql`${driverKits.routeId} = ${routeId} AND ${driverKits.tenantId} = ${tenantId}`)
    .orderBy(desc(driverKits.createdAt))
    .limit(1);
  return kit ?? null;
}

export async function listDriverKits(tenantId: string, options: { limit?: number; offset?: number } = {}) {
  const { limit = 50, offset = 0 } = options;
  return db.select().from(driverKits)
    .where(eq(driverKits.tenantId, tenantId))
    .orderBy(desc(driverKits.createdAt))
    .limit(limit).offset(offset);
}

export async function markKitLoaded(tenantId: string, kitId: string, userId?: string) {
  const [kit] = await db.select({ status: driverKits.status })
    .from(driverKits).where(sql`${driverKits.id} = ${kitId} AND ${driverKits.tenantId} = ${tenantId}`).limit(1);
  if (!kit) return null;
  if (kit.status !== 'loading') {
    throw Object.assign(new Error(`Kit is ${kit.status}, cannot mark as loaded`), { statusCode: 422 });
  }

  const [updated] = await db.update(driverKits)
    .set({ status: 'loaded', loadedAt: new Date(), updatedAt: new Date() })
    .where(sql`${driverKits.id} = ${kitId} AND ${driverKits.tenantId} = ${tenantId}`)
    .returning();

  if (userId) {
    await logActivity({ tenantId, userId, action: 'update', entityType: 'driver_kit', entityId: kitId, metadata: { status: 'loaded' } });
  }
  return updated ?? null;
}

export async function startKitTransit(tenantId: string, kitId: string) {
  const [updated] = await db.update(driverKits)
    .set({ status: 'in_transit', updatedAt: new Date() })
    .where(sql`${driverKits.id} = ${kitId} AND ${driverKits.tenantId} = ${tenantId} AND ${driverKits.status} = 'loaded'`)
    .returning();
  return updated ?? null;
}

interface Discrepancy {
  orderId: string;
  productName: string;
  expected: number;
  returned: number;
  note: string;
}

export async function reconcileKit(
  tenantId: string,
  kitId: string,
  input: ReconcileKitInput,
  userId?: string,
) {
  const kit = await getDriverKit(tenantId, kitId);
  if (!kit) return null;
  if (kit.status !== 'in_transit' && kit.status !== 'reconciling') {
    throw Object.assign(new Error(`Kit is ${kit.status}, cannot reconcile`), { statusCode: 422 });
  }

  // Build discrepancy list by comparing loaded items vs returned
  const loadedItems = (kit.items ?? []) as Array<{ orderId: string; products: Array<{ name: string; quantity: number }> }>;
  const discrepancies: Discrepancy[] = [];

  for (const returnedItem of input.returnedItems) {
    const loaded = loadedItems.find(i => i.orderId === returnedItem.orderId);
    if (!loaded) continue;

    for (const returnedProduct of returnedItem.products) {
      const loadedProduct = loaded.products.find(p => p.name === returnedProduct.name);
      if (!loadedProduct) continue;

      // If the full quantity was loaded but some came back, and the order wasn't delivered,
      // that's expected. But if quantities don't add up, flag it.
      if (returnedProduct.quantityReturned > loadedProduct.quantity) {
        discrepancies.push({
          orderId: returnedItem.orderId,
          productName: returnedProduct.name,
          expected: loadedProduct.quantity,
          returned: returnedProduct.quantityReturned,
          note: 'Returned more than loaded',
        });
      }
    }
  }

  const [updated] = await db.update(driverKits)
    .set({
      status: 'reconciled',
      reconciledAt: new Date(),
      reconciledBy: userId ?? null,
      returnedItems: input.returnedItems,
      discrepancies,
      notes: input.notes ?? kit.notes,
      updatedAt: new Date(),
    })
    .where(sql`${driverKits.id} = ${kitId} AND ${driverKits.tenantId} = ${tenantId}`)
    .returning();

  if (userId) {
    await logActivity({
      tenantId, userId, action: 'update',
      entityType: 'driver_kit', entityId: kitId,
      metadata: { status: 'reconciled', discrepancyCount: discrepancies.length },
    });
  }

  return { kit: updated, discrepancies };
}

// ---------------------------------------------------------------------------
// Delivery limits
// ---------------------------------------------------------------------------

export interface DeliveryLimitCheck {
  withinLimits: boolean;
  totalValue: number;
  totalWeight: number;
  maxValue: number | null;
  maxWeight: number | null;
  warnings: string[];
}

export async function checkDeliveryLimits(tenantId: string, routeId: string): Promise<DeliveryLimitCheck> {
  const settings = await getCannabisSettings(tenantId);
  const maxValue = settings?.maxVehicleValue ?? null;
  const maxWeight = settings?.maxVehicleWeight ?? null;

  // Sum value and weight of all orders on this route
  const routeOrders = await db.select({
    weight: orders.weight,
    cashAmount: orders.cashAmount,
    customFields: orders.customFields,
  })
    .from(orders)
    .where(and(eq(orders.tenantId, tenantId), eq(orders.routeId, routeId)));

  let totalValue = 0;
  let totalWeight = 0;
  for (const o of routeOrders) {
    totalWeight += Number(o.weight) || 0;
    totalValue += Number(o.cashAmount) || 0;
    // Also check customFields.price if cashAmount not set
    if (!o.cashAmount) {
      const cf = o.customFields as Record<string, unknown> | null;
      totalValue += Number(cf?.price) || 0;
    }
  }

  const warnings: string[] = [];
  if (maxValue && totalValue > maxValue) {
    warnings.push(`Total value $${totalValue.toFixed(2)} exceeds vehicle limit of $${maxValue.toFixed(2)}`);
  }
  if (maxWeight && totalWeight > maxWeight) {
    warnings.push(`Total weight ${totalWeight.toFixed(1)}g exceeds vehicle limit of ${maxWeight.toFixed(1)}g`);
  }

  return {
    withinLimits: warnings.length === 0,
    totalValue,
    totalWeight,
    maxValue,
    maxWeight,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Cash collection
// ---------------------------------------------------------------------------

export async function collectCash(tenantId: string, orderId: string, cashCollected: number, userId?: string) {
  const [updated] = await db.update(orders)
    .set({
      cashCollected: String(cashCollected),
      paymentCollectedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(sql`${orders.id} = ${orderId} AND ${orders.tenantId} = ${tenantId}`)
    .returning();

  if (!updated) return null;

  const mismatch = updated.cashAmount && Math.abs(Number(updated.cashAmount) - cashCollected) > 0.01;

  if (userId) {
    await logActivity({
      tenantId, userId, action: 'update',
      entityType: 'order', entityId: orderId,
      metadata: { cashCollected, expected: updated.cashAmount, mismatch },
    });
  }

  return {
    orderId,
    expected: Number(updated.cashAmount) || 0,
    collected: cashCollected,
    mismatch: !!mismatch,
  };
}
