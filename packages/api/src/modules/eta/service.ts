import { eq, and, asc, ne } from 'drizzle-orm';
import type { EtaResponse } from '@homer-io/shared';
import { db } from '../../lib/db/index.js';
import { routes } from '../../lib/db/schema/routes.js';
import { orders } from '../../lib/db/schema/orders.js';
import { drivers } from '../../lib/db/schema/drivers.js';
import { vehicles } from '../../lib/db/schema/vehicles.js';
import { getTrafficAwareETAs, getOsrmETAs } from '../../lib/routing/index.js';
import { NotFoundError } from '../../lib/errors.js';

/**
 * Calculate ETAs for each uncompleted stop on a route.
 * Uses Google Routes API (cached) → OSRM → haversine fallback chain.
 * Called from explicit HTTP endpoint requests.
 */
export async function calculateRouteETAs(
  routeId: string,
  tenantId: string,
): Promise<EtaResponse> {
  const { vehicleType, startLat, startLng, uncompletedOrders } =
    await loadRouteContext(routeId, tenantId);

  if (isNaN(startLat) || isNaN(startLng) || uncompletedOrders.length === 0) {
    return {
      routeId,
      stops: uncompletedOrders.map(o => ({
        orderId: o.id,
        sequence: o.stopSequence ?? 0,
        etaMinutes: null,
        etaTimestamp: null,
        distanceKm: null,
      })),
      totalEtaMinutes: 0,
      calculatedAt: new Date().toISOString(),
    };
  }

  const validStops = uncompletedOrders
    .filter(o => o.deliveryLat && o.deliveryLng)
    .map(o => ({
      orderId: o.id,
      sequence: o.stopSequence ?? 0,
      lat: Number(o.deliveryLat),
      lng: Number(o.deliveryLng),
    }));

  // Full fallback chain: Google (cached) → OSRM → haversine
  const result = await getTrafficAwareETAs(
    routeId,
    [startLat, startLng],
    validStops,
    vehicleType,
  );

  return {
    routeId: result.routeId,
    stops: result.stops,
    totalEtaMinutes: result.totalEtaMinutes,
    calculatedAt: result.calculatedAt,
    source: result.source,
  };
}

/**
 * Recalculate ETAs from driver's current position.
 * Uses OSRM only (no Google) — called at high frequency on location updates.
 */
export async function recalculateFromDriverPosition(
  routeId: string,
  tenantId: string,
  driverLat: number,
  driverLng: number,
): Promise<EtaResponse> {
  const { vehicleType, uncompletedOrders } =
    await loadRouteContext(routeId, tenantId);

  if (uncompletedOrders.length === 0) {
    return {
      routeId,
      stops: [],
      totalEtaMinutes: 0,
      calculatedAt: new Date().toISOString(),
    };
  }

  const validStops = uncompletedOrders
    .filter(o => o.deliveryLat && o.deliveryLng)
    .map(o => ({
      orderId: o.id,
      sequence: o.stopSequence ?? 0,
      lat: Number(o.deliveryLat),
      lng: Number(o.deliveryLng),
    }));

  // OSRM only — fast, no API cost, suitable for high-frequency calls
  const result = await getOsrmETAs(
    routeId,
    [driverLat, driverLng],
    validStops,
    vehicleType,
  );

  return {
    routeId: result.routeId,
    stops: result.stops,
    totalEtaMinutes: result.totalEtaMinutes,
    calculatedAt: result.calculatedAt,
    source: result.source,
  };
}

// ---- Shared route context loader ----

async function loadRouteContext(routeId: string, tenantId: string) {
  const [route] = await db
    .select({
      id: routes.id,
      driverId: routes.driverId,
      vehicleId: routes.vehicleId,
      depotLat: routes.depotLat,
      depotLng: routes.depotLng,
      status: routes.status,
    })
    .from(routes)
    .where(and(eq(routes.id, routeId), eq(routes.tenantId, tenantId)))
    .limit(1);

  if (!route) throw new NotFoundError('Route not found');

  let vehicleType = 'car';
  if (route.vehicleId) {
    const [vehicle] = await db
      .select({ type: vehicles.type })
      .from(vehicles)
      .where(eq(vehicles.id, route.vehicleId))
      .limit(1);
    if (vehicle) vehicleType = vehicle.type;
  }

  let startLat = route.depotLat ? Number(route.depotLat) : NaN;
  let startLng = route.depotLng ? Number(route.depotLng) : NaN;

  if (route.driverId) {
    const [driver] = await db
      .select({ currentLat: drivers.currentLat, currentLng: drivers.currentLng })
      .from(drivers)
      .where(eq(drivers.id, route.driverId))
      .limit(1);
    if (driver?.currentLat && driver?.currentLng) {
      startLat = Number(driver.currentLat);
      startLng = Number(driver.currentLng);
    }
  }

  const uncompletedOrders = await db
    .select({
      id: orders.id,
      stopSequence: orders.stopSequence,
      deliveryLat: orders.deliveryLat,
      deliveryLng: orders.deliveryLng,
    })
    .from(orders)
    .where(
      and(
        eq(orders.routeId, routeId),
        eq(orders.tenantId, tenantId),
        ne(orders.status, 'delivered'),
        ne(orders.status, 'failed'),
        ne(orders.status, 'returned'),
      ),
    )
    .orderBy(asc(orders.stopSequence));

  return { vehicleType, startLat, startLng, uncompletedOrders };
}
