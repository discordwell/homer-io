import { eq, and, asc, ne } from 'drizzle-orm';
import type { EtaResponse } from '@homer-io/shared';
import { db } from '../../lib/db/index.js';
import { routes } from '../../lib/db/schema/routes.js';
import { orders } from '../../lib/db/schema/orders.js';
import { drivers } from '../../lib/db/schema/drivers.js';
import { vehicles } from '../../lib/db/schema/vehicles.js';
import { haversineDistance, estimateEtaMinutes } from '../../lib/geo.js';
import { NotFoundError } from '../../lib/errors.js';

/**
 * Calculate ETAs for each uncompleted stop on a route, starting from the
 * driver's current position (if available) or the depot.
 */
export async function calculateRouteETAs(
  routeId: string,
  tenantId: string,
): Promise<EtaResponse> {
  // Load route with vehicle type
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

  if (!route) {
    throw new NotFoundError('Route not found');
  }

  // Determine vehicle type
  let vehicleType = 'car';
  if (route.vehicleId) {
    const [vehicle] = await db
      .select({ type: vehicles.type })
      .from(vehicles)
      .where(eq(vehicles.id, route.vehicleId))
      .limit(1);
    if (vehicle) vehicleType = vehicle.type;
  }

  // Get driver position as starting point — require valid coordinates
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

  // Load uncompleted orders for route ordered by stopSequence
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

  const now = new Date();
  let cumulativeMinutes = 0;
  let prevLat = startLat;
  let prevLng = startLng;

  const stops = uncompletedOrders.map((order) => {
    const toLat = order.deliveryLat ? Number(order.deliveryLat) : NaN;
    const toLng = order.deliveryLng ? Number(order.deliveryLng) : NaN;

    // Skip ETA calculation for stops or origins with missing coordinates
    const hasValidCoords = !isNaN(prevLat) && !isNaN(prevLng) && !isNaN(toLat) && !isNaN(toLng);

    let etaMin = 0;
    let distKm = 0;
    if (hasValidCoords) {
      etaMin = estimateEtaMinutes(prevLat, prevLng, toLat, toLng, vehicleType);
      distKm = haversineDistance(prevLat, prevLng, toLat, toLng);
      cumulativeMinutes += etaMin;
    }

    const etaTimestamp = new Date(now.getTime() + cumulativeMinutes * 60_000);

    // Update prev coordinates only if the current stop has valid coords
    if (!isNaN(toLat) && !isNaN(toLng)) {
      prevLat = toLat;
      prevLng = toLng;
    }

    return {
      orderId: order.id,
      sequence: order.stopSequence ?? 0,
      etaMinutes: hasValidCoords ? Math.round(cumulativeMinutes * 10) / 10 : null,
      etaTimestamp: hasValidCoords ? etaTimestamp.toISOString() : null,
      distanceKm: hasValidCoords ? Math.round(distKm * 100) / 100 : null,
    };
  });

  return {
    routeId,
    stops,
    totalEtaMinutes: Math.round(cumulativeMinutes * 10) / 10,
    calculatedAt: now.toISOString(),
  };
}

/**
 * Recalculate ETAs based on current driver position (called on location updates).
 */
export async function recalculateFromDriverPosition(
  routeId: string,
  tenantId: string,
  driverLat: number,
  driverLng: number,
): Promise<EtaResponse> {
  // Load route with vehicle type
  const [route] = await db
    .select({
      id: routes.id,
      vehicleId: routes.vehicleId,
    })
    .from(routes)
    .where(and(eq(routes.id, routeId), eq(routes.tenantId, tenantId)))
    .limit(1);

  if (!route) {
    throw new NotFoundError('Route not found');
  }

  let vehicleType = 'car';
  if (route.vehicleId) {
    const [vehicle] = await db
      .select({ type: vehicles.type })
      .from(vehicles)
      .where(eq(vehicles.id, route.vehicleId))
      .limit(1);
    if (vehicle) vehicleType = vehicle.type;
  }

  // Load uncompleted orders
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

  const now = new Date();
  let cumulativeMinutes = 0;
  let prevLat = driverLat;
  let prevLng = driverLng;

  const stops = uncompletedOrders.map((order) => {
    const toLat = order.deliveryLat ? Number(order.deliveryLat) : NaN;
    const toLng = order.deliveryLng ? Number(order.deliveryLng) : NaN;

    // Skip ETA calculation for stops with missing coordinates
    const hasValidCoords = !isNaN(prevLat) && !isNaN(prevLng) && !isNaN(toLat) && !isNaN(toLng);

    let etaMin = 0;
    let distKm = 0;
    if (hasValidCoords) {
      etaMin = estimateEtaMinutes(prevLat, prevLng, toLat, toLng, vehicleType);
      distKm = haversineDistance(prevLat, prevLng, toLat, toLng);
      cumulativeMinutes += etaMin;
    }

    const etaTimestamp = new Date(now.getTime() + cumulativeMinutes * 60_000);

    if (!isNaN(toLat) && !isNaN(toLng)) {
      prevLat = toLat;
      prevLng = toLng;
    }

    return {
      orderId: order.id,
      sequence: order.stopSequence ?? 0,
      etaMinutes: hasValidCoords ? Math.round(cumulativeMinutes * 10) / 10 : null,
      etaTimestamp: hasValidCoords ? etaTimestamp.toISOString() : null,
      distanceKm: hasValidCoords ? Math.round(distKm * 100) / 100 : null,
    };
  });

  return {
    routeId,
    stops,
    totalEtaMinutes: Math.round(cumulativeMinutes * 10) / 10,
    calculatedAt: now.toISOString(),
  };
}
