import { eq, and, ne, isNotNull, sql } from 'drizzle-orm';
import type { LocationUpdate } from '@homer-io/shared';
import { db } from '../../lib/db/index.js';
import { drivers } from '../../lib/db/schema/drivers.js';
import { locationHistory } from '../../lib/db/schema/location-history.js';
import { routes } from '../../lib/db/schema/routes.js';
import { broadcastToTenant } from '../../lib/ws/index.js';

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
 * Update a driver's current location, persist to history, and broadcast.
 */
export async function updateDriverLocation(
  tenantId: string,
  driverId: string,
  location: LocationUpdate,
) {
  const now = new Date();

  // Update driver's current position
  await db
    .update(drivers)
    .set({
      currentLat: location.lat.toString(),
      currentLng: location.lng.toString(),
      lastLocationAt: now,
      updatedAt: now,
    })
    .where(and(eq(drivers.id, driverId), eq(drivers.tenantId, tenantId)));

  // Insert location history record
  await db.insert(locationHistory).values({
    tenantId,
    driverId,
    lat: location.lat.toString(),
    lng: location.lng.toString(),
    speed: location.speed?.toString() ?? null,
    heading: location.heading ?? null,
    accuracy: location.accuracy?.toString() ?? null,
    timestamp: now,
  });

  // Fetch driver name for the broadcast payload
  const [driver] = await db
    .select({ name: drivers.name, status: drivers.status })
    .from(drivers)
    .where(eq(drivers.id, driverId))
    .limit(1);

  // Broadcast to all tenant users watching the fleet namespace
  broadcastToTenant(tenantId, 'driver:location', {
    driverId,
    driverName: driver?.name ?? 'Unknown',
    driverStatus: driver?.status ?? 'offline',
    lat: location.lat,
    lng: location.lng,
    speed: location.speed ?? null,
    heading: location.heading ?? null,
    updatedAt: now.toISOString(),
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
