import type { Job } from 'bullmq';
import { eq, and, sql } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';
import { db } from '../lib/db.js';
import {
  orders, routes, locationHistory, proofOfDelivery,
  addressIntelligence, deliveryMetrics,
} from '../lib/schema.js';
import { config } from '../lib/config.js';
import { logger } from '../lib/logger.js';
import { createHash } from 'node:crypto';

const log = logger.child({ worker: 'delivery-learning' });

export interface DeliveryLearningJobData {
  tenantId: string;
  orderId: string;
  routeId: string;
  status: 'delivered' | 'failed';
  failureReason?: string;
  completedAt: string;
}

const FAILURE_CATEGORIES = [
  'not_home', 'wrong_address', 'access_denied', 'refused',
  'damaged', 'business_closed', 'weather', 'vehicle_issue', 'other',
] as const;

type FailureCategory = typeof FAILURE_CATEGORIES[number];

interface AddressComponents {
  street: string;
  city: string;
  state: string;
  zip: string;
  country?: string;
}

// ─── Address normalization (duplicated from API to avoid cross-package import) ───

function normalizeAddress(addr: AddressComponents) {
  const street = addr.street?.trim().toLowerCase() ?? '';
  const city = addr.city?.trim().toLowerCase() ?? '';
  const state = addr.state?.trim().toLowerCase() ?? '';
  const zip = addr.zip?.trim() ?? '';
  const country = addr.country?.trim().toLowerCase() || 'us';

  const building = street
    .replace(/\b(apt|apartment|suite|ste|unit|room|rm|fl|floor|dept|department)\b\.?\s*\S*/gi, '')
    .replace(/#\s*\S*/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return { street, building, city, state, zip, country };
}

function hashAddress(addr: AddressComponents): string {
  const normalized = normalizeAddress(addr);
  const key = [normalized.building, normalized.city, normalized.state, normalized.zip, normalized.country].join('|');
  return createHash('sha256').update(key).digest('hex');
}

// ─── Haversine (duplicated to avoid cross-package dependency) ───

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Main worker processor ───

export async function processDeliveryLearning(job: Job<DeliveryLearningJobData>) {
  const { tenantId, orderId, routeId, status, failureReason, completedAt } = job.data;
  log.info('Processing delivery learning', { orderId, status });

  // 1. Fetch order
  const [order] = await db.select().from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.tenantId, tenantId)))
    .limit(1);

  if (!order) {
    log.warn('Order not found, skipping', { orderId });
    return { skipped: true, reason: 'order_not_found' };
  }

  const deliveryAddr = order.deliveryAddress as AddressComponents | null;
  if (!deliveryAddr?.street) {
    log.warn('No delivery address, skipping intelligence', { orderId });
    return { skipped: true, reason: 'no_address' };
  }

  const completedAtDate = new Date(completedAt);

  // 2. Compute GPS-based metrics
  const metrics = await computeMetrics(tenantId, orderId, routeId, order, completedAtDate);

  // 3. Upsert address intelligence
  const addrHash = hashAddress(deliveryAddr);
  const normalized = normalizeAddress(deliveryAddr);
  const addressIntelId = await upsertAddressIntelligence(
    tenantId, addrHash, normalized, order, status, metrics.serviceTimeSeconds, completedAtDate,
    failureReason,
  );

  // 4. Record delivery metrics
  const failureCat = status === 'failed'
    ? await classifyFailure(failureReason)
    : undefined;

  await db.insert(deliveryMetrics).values({
    tenantId,
    orderId,
    routeId,
    addressIntelligenceId: addressIntelId,
    estimatedArrivalAt: metrics.estimatedArrivalAt,
    actualArrivalAt: metrics.actualArrivalAt,
    serviceTimeSeconds: metrics.serviceTimeSeconds,
    etaErrorMinutes: metrics.etaErrorMinutes?.toString(),
    estimatedDistanceKm: metrics.estimatedDistanceKm?.toString(),
    actualDistanceKm: metrics.actualDistanceKm?.toString(),
    deliveryStatus: status,
    failureCategory: failureCat,
    completedAt: completedAtDate,
  });

  // 5. Update order failure_category if failed
  if (failureCat) {
    await db.update(orders)
      .set({ failureCategory: failureCat })
      .where(and(eq(orders.id, orderId), eq(orders.tenantId, tenantId)));
  }

  // 6. LLM extraction from POD notes (fire-and-forget, non-blocking)
  extractPodInsights(tenantId, orderId, addressIntelId).catch(err =>
    log.error('POD insight extraction failed', { orderId, error: err instanceof Error ? err.message : String(err) }),
  );

  log.info('Delivery learning complete', { orderId, addressIntelId, failureCat });
  return { orderId, addressIntelId, failureCategory: failureCat };
}

// ─── GPS Metrics Computation ───

interface ComputedMetrics {
  estimatedArrivalAt: Date | undefined;
  actualArrivalAt: Date | undefined;
  serviceTimeSeconds: number | undefined;
  etaErrorMinutes: number | undefined;
  estimatedDistanceKm: number | undefined;
  actualDistanceKm: number | undefined;
}

async function computeMetrics(
  tenantId: string, orderId: string, routeId: string,
  order: typeof orders.$inferSelect, completedAt: Date,
): Promise<ComputedMetrics> {
  const result: ComputedMetrics = {
    estimatedArrivalAt: undefined,
    actualArrivalAt: undefined,
    serviceTimeSeconds: undefined,
    etaErrorMinutes: undefined,
    estimatedDistanceKm: undefined,
    actualDistanceKm: undefined,
  };

  // Use ETA from order time window as estimated arrival
  result.estimatedArrivalAt = order.timeWindowStart ?? undefined;

  const deliveryLat = order.deliveryLat ? Number(order.deliveryLat) : null;
  const deliveryLng = order.deliveryLng ? Number(order.deliveryLng) : null;

  if (!deliveryLat || !deliveryLng) return result;

  // Find the route to get the driver
  const [route] = await db.select({ driverId: routes.driverId })
    .from(routes)
    .where(and(eq(routes.id, routeId), eq(routes.tenantId, tenantId)))
    .limit(1);

  if (!route?.driverId) return result;

  // Find GPS breadcrumbs near delivery location (within ~200m)
  // Look at location history from the route's duration
  const breadcrumbs = await db.select()
    .from(locationHistory)
    .where(and(
      eq(locationHistory.tenantId, tenantId),
      eq(locationHistory.driverId, route.driverId),
      sql`${locationHistory.timestamp} >= ${completedAt.toISOString()}::timestamptz - interval '4 hours'`,
      sql`${locationHistory.timestamp} <= ${completedAt.toISOString()}::timestamptz + interval '10 minutes'`,
    ))
    .orderBy(locationHistory.timestamp)
    .limit(500);

  if (breadcrumbs.length === 0) return result;

  // Find first breadcrumb within 200m of delivery location (arrival)
  const ARRIVAL_RADIUS_KM = 0.2;
  const arrivalCrumb = breadcrumbs.find(bc => {
    const lat = Number(bc.lat);
    const lng = Number(bc.lng);
    return haversineKm(lat, lng, deliveryLat, deliveryLng) <= ARRIVAL_RADIUS_KM;
  });

  if (arrivalCrumb) {
    result.actualArrivalAt = arrivalCrumb.timestamp;

    // Service time = completion - arrival
    const serviceMs = completedAt.getTime() - arrivalCrumb.timestamp.getTime();
    if (serviceMs > 0 && serviceMs < 7200000) { // Cap at 2 hours
      result.serviceTimeSeconds = Math.round(serviceMs / 1000);
    }

    // ETA error
    if (result.estimatedArrivalAt) {
      const errorMs = arrivalCrumb.timestamp.getTime() - result.estimatedArrivalAt.getTime();
      result.etaErrorMinutes = Math.round((errorMs / 60000) * 100) / 100;
    }
  }

  // Compute actual distance from GPS breadcrumbs
  let totalDistanceKm = 0;
  for (let i = 1; i < breadcrumbs.length; i++) {
    const prev = breadcrumbs[i - 1];
    const curr = breadcrumbs[i];
    totalDistanceKm += haversineKm(
      Number(prev.lat), Number(prev.lng),
      Number(curr.lat), Number(curr.lng),
    );
  }
  if (totalDistanceKm > 0) {
    result.actualDistanceKm = Math.round(totalDistanceKm * 1000) / 1000;
  }

  return result;
}

// ─── Address Intelligence Upsert ───

async function upsertAddressIntelligence(
  tenantId: string, addrHash: string, normalized: ReturnType<typeof normalizeAddress>,
  order: typeof orders.$inferSelect, status: 'delivered' | 'failed',
  serviceTimeSeconds: number | undefined, completedAt: Date,
  failureReason: string | undefined,
): Promise<string> {
  const deliveryLat = order.deliveryLat;
  const deliveryLng = order.deliveryLng;
  const completedHour = completedAt.getUTCHours();

  // Try to find existing record
  const [existing] = await db.select()
    .from(addressIntelligence)
    .where(and(
      eq(addressIntelligence.tenantId, tenantId),
      eq(addressIntelligence.addressHash, addrHash),
    ))
    .limit(1);

  if (existing) {
    // Update running averages
    const newTotal = existing.totalDeliveries + 1;
    const newSuccess = status === 'delivered' ? existing.successfulDeliveries + 1 : existing.successfulDeliveries;
    const newFailed = status === 'failed' ? existing.failedDeliveries + 1 : existing.failedDeliveries;

    // Incremental average for service time
    let newAvgServiceTime = existing.avgServiceTimeSeconds;
    if (serviceTimeSeconds != null && serviceTimeSeconds > 0) {
      const oldAvg = existing.avgServiceTimeSeconds ? Number(existing.avgServiceTimeSeconds) : 0;
      const oldCount = existing.totalDeliveries;
      newAvgServiceTime = oldCount > 0
        ? String(((oldAvg * oldCount) + serviceTimeSeconds) / newTotal)
        : String(serviceTimeSeconds);
    }

    // Update hourly delivery patterns
    const hourlyPatterns = (existing.bestDeliveryHours as Array<{ hour: number; success_rate: number; sample_size: number }>) || [];
    const hourEntry = hourlyPatterns.find(h => h.hour === completedHour);
    if (hourEntry) {
      const newSampleSize = hourEntry.sample_size + 1;
      const successIncrement = status === 'delivered' ? 1 : 0;
      hourEntry.success_rate = ((hourEntry.success_rate * hourEntry.sample_size) + successIncrement) / newSampleSize;
      hourEntry.sample_size = newSampleSize;
    } else {
      hourlyPatterns.push({
        hour: completedHour,
        success_rate: status === 'delivered' ? 1 : 0,
        sample_size: 1,
      });
    }

    // Update failure reasons
    const failureReasons = (existing.commonFailureReasons as Array<{ reason: string; count: number }>) || [];
    if (status === 'failed' && failureReason) {
      const reasonEntry = failureReasons.find(r => r.reason === failureReason);
      if (reasonEntry) {
        reasonEntry.count += 1;
      } else {
        failureReasons.push({ reason: failureReason, count: 1 });
      }
    }

    await db.update(addressIntelligence)
      .set({
        totalDeliveries: newTotal,
        successfulDeliveries: newSuccess,
        failedDeliveries: newFailed,
        avgServiceTimeSeconds: newAvgServiceTime,
        bestDeliveryHours: hourlyPatterns,
        commonFailureReasons: failureReasons,
        lastDeliveryAt: completedAt,
        updatedAt: new Date(),
      })
      .where(eq(addressIntelligence.id, existing.id));

    return existing.id;
  } else {
    // Create new record
    const [created] = await db.insert(addressIntelligence).values({
      tenantId,
      addressHash: addrHash,
      addressNormalized: normalized,
      deliveryLat,
      deliveryLng,
      avgServiceTimeSeconds: serviceTimeSeconds != null ? String(serviceTimeSeconds) : null,
      successfulDeliveries: status === 'delivered' ? 1 : 0,
      failedDeliveries: status === 'failed' ? 1 : 0,
      totalDeliveries: 1,
      bestDeliveryHours: [{
        hour: completedHour,
        success_rate: status === 'delivered' ? 1 : 0,
        sample_size: 1,
      }],
      commonFailureReasons: status === 'failed' && failureReason
        ? [{ reason: failureReason, count: 1 }]
        : [],
      lastDeliveryAt: completedAt,
    }).returning({ id: addressIntelligence.id });

    return created.id;
  }
}

// ─── Failure Classification ───

async function classifyFailure(failureReason: string | undefined): Promise<FailureCategory | undefined> {
  if (!failureReason) return 'other';

  const reason = failureReason.toLowerCase();

  // Simple keyword matching first (fast path, no API call needed)
  if (reason.includes('not home') || reason.includes('no one') || reason.includes('nobody') || reason.includes('no answer')) return 'not_home';
  if (reason.includes('wrong address') || reason.includes('incorrect address') || reason.includes('bad address')) return 'wrong_address';
  if (reason.includes('access') || reason.includes('gate') || reason.includes('locked') || reason.includes('no entry')) return 'access_denied';
  if (reason.includes('refused') || reason.includes('reject') || reason.includes('declined')) return 'refused';
  if (reason.includes('damaged') || reason.includes('broken')) return 'damaged';
  if (reason.includes('closed') || reason.includes('not open') || reason.includes('business hours')) return 'business_closed';
  if (reason.includes('weather') || reason.includes('storm') || reason.includes('flood') || reason.includes('snow')) return 'weather';
  if (reason.includes('vehicle') || reason.includes('flat tire') || reason.includes('broke down') || reason.includes('mechanical')) return 'vehicle_issue';

  return 'other';
}

// ─── LLM POD Insight Extraction ───

async function extractPodInsights(
  tenantId: string, orderId: string, addressIntelId: string,
): Promise<void> {
  if (!config.anthropic.apiKey) return;

  // Fetch POD notes
  const [pod] = await db.select({ notes: proofOfDelivery.notes })
    .from(proofOfDelivery)
    .where(and(
      eq(proofOfDelivery.tenantId, tenantId),
      eq(proofOfDelivery.orderId, orderId),
    ))
    .limit(1);

  if (!pod?.notes || pod.notes.trim().length < 5) return;

  const client = new Anthropic({ apiKey: config.anthropic.apiKey });

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system: 'You extract structured delivery insights from driver notes. Respond with JSON only, no markdown.',
    messages: [{
      role: 'user',
      content: `Extract delivery insights from these driver notes. Return JSON with these optional fields:
- "access_instructions": string (how to access the building/unit, e.g. "use side door", "buzzer code 4521")
- "parking_notes": string (where to park, e.g. "park in loading zone on east side")
- "customer_preferences": string (any customer preferences, e.g. "leave at front door", "ring bell twice")

Only include fields that have clear information in the notes. If nothing extractable, return {}.

Notes: "${pod.notes}"`,
    }],
  });

  const textBlock = response.content.find(b => b.type === 'text');
  if (!textBlock) return;

  let extracted: Record<string, unknown>;
  try {
    extracted = JSON.parse(textBlock.text);
  } catch {
    log.warn('Failed to parse LLM extraction', { orderId, text: textBlock.text });
    return;
  }

  // Merge extracted insights into address intelligence (append, don't overwrite)
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (extracted.access_instructions) updates.accessInstructions = extracted.access_instructions;
  if (extracted.parking_notes) updates.parkingNotes = extracted.parking_notes;
  if (extracted.customer_preferences) updates.customerPreferences = extracted.customer_preferences;

  if (Object.keys(updates).length > 1) {
    await db.update(addressIntelligence)
      .set(updates)
      .where(eq(addressIntelligence.id, addressIntelId));

    log.info('Extracted POD insights', { orderId, addressIntelId, fields: Object.keys(extracted) });
  }
}
