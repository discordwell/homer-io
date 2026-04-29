import { eq, and, ne, isNotNull, desc, or, lt, isNull } from 'drizzle-orm';
import type { LocationUpdate } from '@homer-io/shared';
import { db } from '../../lib/db/index.js';
import { drivers } from '../../lib/db/schema/drivers.js';
import { vehicles } from '../../lib/db/schema/vehicles.js';
import { locationHistory } from '../../lib/db/schema/location-history.js';
import { locationConflicts } from '../../lib/db/schema/location-conflicts.js';
import { routes } from '../../lib/db/schema/routes.js';
import { broadcastToTenant } from '../../lib/ws/index.js';
import { logger } from '../../lib/logger.js';
import { checkGeofences } from '../geofencing/service.js';
import { recalculateFromDriverPosition } from '../eta/service.js';

export type LocationSource = 'driver_app' | 'samsara' | 'motive' | 'geotab';

export interface MergePositionInput {
  tenantId: string;
  driverId?: string | null;
  vehicleId?: string | null;
  source: LocationSource;
  lat: number;
  lng: number;
  speed?: number | null;
  heading?: number | null;
  accuracy?: number | null;
  recordedAt?: Date;
}

/**
 * Great-circle distance in metres (haversine). Good enough for the ±500m
 * conflict threshold; not used for anything that needs high precision.
 */
export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const CONFLICT_DISTANCE_METERS = 500;
const CONFLICT_WINDOW_MS = 60_000;

/**
 * Find the driver record linked to a user account.
 */
export async function findDriverByUserId(tenantId: string, userId: string): Promise<string | null> {
  const [driver] = await db
    .select({ id: drivers.id })
    .from(drivers)
    .where(and(eq(drivers.tenantId, tenantId), eq(drivers.userId, userId)))
    .limit(1);
  return driver?.id ?? null;
}

/**
 * Source-aware position merge. Handles positions arriving from the driver app
 * (via POST /api/tracking/location) and from telematics providers (Samsara,
 * Motive, Geotab).
 *
 * Driver.current* fields are updated only when the new position is strictly
 * newer than what's already recorded — prevents an out-of-order or delayed
 * webhook from overwriting a fresher driver-app ping.
 *
 * When driver-app and telematics positions within the same 60s window
 * disagree by more than 500 metres, we log to location_conflicts (diagnostic
 * only) and prefer the driver-app position (they carry the package).
 */
export async function mergePosition(input: MergePositionInput): Promise<void> {
  const now = input.recordedAt ?? new Date();
  const { tenantId, driverId, vehicleId, source, lat, lng } = input;

  // Insert into history regardless of source so we have a full audit trail.
  if (driverId) {
    await db.insert(locationHistory).values({
      tenantId,
      driverId,
      lat: lat.toString(),
      lng: lng.toString(),
      speed: input.speed?.toString() ?? null,
      heading: input.heading ?? null,
      accuracy: input.accuracy?.toString() ?? null,
      source,
      timestamp: now,
    });
  }

  if (driverId) {
    await updateDriverCurrentPositionWithConflictCheck({
      tenantId, driverId, source, lat, lng, recordedAt: now, vehicleId: vehicleId ?? null,
    });
  }

  if (vehicleId) {
    await db
      .update(vehicles)
      .set({ lastLat: lat.toString(), lastLng: lng.toString(), lastLocationAt: now, lastLocationSource: source, updatedAt: now })
      .where(and(eq(vehicles.id, vehicleId), eq(vehicles.tenantId, tenantId)));
  }

  // Fetch driver name + status for the broadcast payload (skipped when only a vehicle is in scope).
  let driverName = 'Unknown';
  let driverStatus: string = 'offline';
  if (driverId) {
    const [driver] = await db
      .select({ name: drivers.name, status: drivers.status })
      .from(drivers)
      .where(eq(drivers.id, driverId))
      .limit(1);
    if (driver) { driverName = driver.name; driverStatus = driver.status; }
  }

  broadcastToTenant(tenantId, 'driver:location', {
    driverId: driverId ?? null,
    vehicleId: vehicleId ?? null,
    driverName,
    driverStatus,
    source,
    lat, lng,
    speed: input.speed ?? null,
    heading: input.heading ?? null,
    updatedAt: now.toISOString(),
  });

  if (driverId) {
    // Fire-and-forget: geofence checks + ETA recalc.
    checkGeofences(tenantId, driverId, lat, lng).catch((err) =>
      logger.error({ err, tenantId, driverId }, '[tracking] Geofence check failed'),
    );
    (async () => {
      try {
        const [activeRoute] = await db
          .select({ id: routes.id })
          .from(routes)
          .where(and(
            eq(routes.tenantId, tenantId),
            eq(routes.driverId, driverId),
            eq(routes.status, 'in_progress'),
          ))
          .limit(1);
        if (activeRoute) {
          const etas = await recalculateFromDriverPosition(activeRoute.id, tenantId, lat, lng);
          broadcastToTenant(tenantId, 'route:eta', etas);
        }
      } catch (err) {
        logger.error({ err, tenantId, driverId }, '[tracking] ETA recalculation failed');
      }
    })();
  }
}

/**
 * Update drivers.current* only when the new position is strictly newer.
 * Detect conflicts when the existing position is from a different source and
 * within the 60s window but >500m away.
 */
async function updateDriverCurrentPositionWithConflictCheck(args: {
  tenantId: string;
  driverId: string;
  source: LocationSource;
  lat: number;
  lng: number;
  recordedAt: Date;
  vehicleId: string | null;
}): Promise<void> {
  const { tenantId, driverId, source, lat, lng, recordedAt, vehicleId } = args;

  // Find the existing current position for conflict detection.
  const [existing] = await db
    .select({
      lat: drivers.currentLat,
      lng: drivers.currentLng,
      lastLocationAt: drivers.lastLocationAt,
    })
    .from(drivers)
    .where(and(eq(drivers.id, driverId), eq(drivers.tenantId, tenantId)))
    .limit(1);

  // Find the most recent *other* history row to learn which source set the
  // existing current position. The earlier INSERT into location_history for
  // this merge already happened, so we must exclude the row we just wrote by
  // picking the newest row with a strictly older timestamp than recordedAt.
  let existingSource: LocationSource | null = null;
  if (existing?.lat && existing?.lng && existing.lastLocationAt) {
    const [prev] = await db
      .select({ source: locationHistory.source })
      .from(locationHistory)
      .where(and(
        eq(locationHistory.tenantId, tenantId),
        eq(locationHistory.driverId, driverId),
        lt(locationHistory.timestamp, recordedAt),
      ))
      .orderBy(desc(locationHistory.timestamp))
      .limit(1);
    existingSource = (prev?.source ?? null) as LocationSource | null;
  }

  // Conflict detection.
  if (
    existing?.lat && existing?.lng && existing.lastLocationAt &&
    existingSource && existingSource !== source &&
    Math.abs(recordedAt.getTime() - existing.lastLocationAt.getTime()) < CONFLICT_WINDOW_MS
  ) {
    const distance = haversineMeters(
      Number(existing.lat), Number(existing.lng), lat, lng,
    );
    if (distance > CONFLICT_DISTANCE_METERS) {
      await db.insert(locationConflicts).values({
        tenantId,
        driverId,
        vehicleId,
        sourceA: existingSource,
        sourceB: source,
        distanceMeters: distance.toFixed(2),
        latA: existing.lat.toString(),
        lngA: existing.lng.toString(),
        latB: lat.toString(),
        lngB: lng.toString(),
      }).catch((err) => logger.error({ err }, '[tracking] location_conflicts insert failed'));

      // Prefer driver_app — the person carrying the package.
      if (source !== 'driver_app' && existingSource === 'driver_app') {
        return; // Leave drivers.current* untouched.
      }
    }
  }

  // Freshness guard: enforce in SQL so two concurrent mergePosition calls
  // can't both pass an in-memory check and then both write. `last_location_at
  // IS NULL OR last_location_at < recordedAt` makes the write atomic on a
  // single row. Prevents out-of-order overwrites across driver_app/telematics.
  await db
    .update(drivers)
    .set({
      currentLat: lat.toString(),
      currentLng: lng.toString(),
      lastLocationAt: recordedAt,
      updatedAt: recordedAt,
    })
    .where(and(
      eq(drivers.id, driverId),
      eq(drivers.tenantId, tenantId),
      or(isNull(drivers.lastLocationAt), lt(drivers.lastLocationAt, recordedAt)),
    ));
}

/**
 * Back-compat entry point for the driver app: POST /api/tracking/location.
 */
export async function updateDriverLocation(
  tenantId: string,
  driverId: string,
  location: LocationUpdate,
): Promise<void> {
  await mergePosition({
    tenantId,
    driverId,
    source: 'driver_app',
    lat: location.lat,
    lng: location.lng,
    speed: location.speed ?? null,
    heading: location.heading ?? null,
    accuracy: location.accuracy ?? null,
  });
}

/**
 * Get all active (non-offline) drivers that have a known location.
 */
export async function getActiveDriverLocations(tenantId: string) {
  const items = await db
    .select({
      id: drivers.id,
      name: drivers.name,
      status: drivers.status,
      currentLat: drivers.currentLat,
      currentLng: drivers.currentLng,
      lastLocationAt: drivers.lastLocationAt,
    })
    .from(drivers)
    .where(
      and(
        eq(drivers.tenantId, tenantId),
        ne(drivers.status, 'offline'),
        isNotNull(drivers.currentLat),
        isNotNull(drivers.currentLng),
      ),
    );

  return items.map((d) => ({
    driverId: d.id,
    driverName: d.name,
    driverStatus: d.status,
    lat: Number(d.currentLat),
    lng: Number(d.currentLng),
    updatedAt: d.lastLocationAt?.toISOString() ?? null,
  }));
}

/**
 * Get progress for a specific route including driver position.
 */
export async function getRouteProgress(tenantId: string, routeId: string) {
  const [route] = await db
    .select()
    .from(routes)
    .where(and(eq(routes.id, routeId), eq(routes.tenantId, tenantId)))
    .limit(1);

  if (!route) {
    throw new (await import('../../lib/errors.js')).NotFoundError('Route not found');
  }

  let driverLocation: { lat: number; lng: number; updatedAt: string | null } | null = null;
  if (route.driverId) {
    const [driver] = await db
      .select({
        currentLat: drivers.currentLat,
        currentLng: drivers.currentLng,
        lastLocationAt: drivers.lastLocationAt,
      })
      .from(drivers)
      .where(eq(drivers.id, route.driverId))
      .limit(1);

    if (driver?.currentLat && driver?.currentLng) {
      driverLocation = {
        lat: Number(driver.currentLat),
        lng: Number(driver.currentLng),
        updatedAt: driver.lastLocationAt?.toISOString() ?? null,
      };
    }
  }

  return {
    routeId: route.id,
    status: route.status,
    totalStops: route.totalStops,
    completedStops: route.completedStops,
    driverLocation,
    actualStartAt: route.actualStartAt?.toISOString() ?? null,
    actualEndAt: route.actualEndAt?.toISOString() ?? null,
  };
}
