import { eq, and, inArray, isNull } from 'drizzle-orm';
import { db } from '../../lib/db/index.js';
import { orders } from '../../lib/db/schema/orders.js';
import { drivers } from '../../lib/db/schema/drivers.js';
import { vehicles } from '../../lib/db/schema/vehicles.js';
import { dispatchOrders } from '../../lib/routing/index.js';
import { createRoute, transitionRouteStatus } from '../routes/service.js';
import { broadcastToTenant } from '../../lib/ws/index.js';
import { logActivity } from '../../lib/activity.js';
import { recordMeteredUsage } from '../billing/service.js';
import type { AutoDispatchRequest } from '@homer-io/shared';

export async function autoDispatch(tenantId: string, input: AutoDispatchRequest, userId?: string) {
  // Metered billing — feature key is 'aiDispatches' for legacy reasons (now OSRM+VRP powered)
  const meter = await recordMeteredUsage(tenantId, 'aiDispatches');
  if (!meter.allowed) {
    return {
      routes: [],
      unassignedOrderIds: [],
      totalOrders: 0,
      totalDrivers: 0,
      message: meter.reason || 'Dispatch quota exceeded. Enable Pay-as-you-go in Settings > Billing.',
    };
  }

  // 1. Get unassigned orders
  const unassignedOrders = await db.select().from(orders)
    .where(and(
      eq(orders.tenantId, tenantId),
      eq(orders.status, 'received'),
      isNull(orders.routeId),
    ));

  if (unassignedOrders.length === 0) {
    return { routes: [], unassignedOrderIds: [], totalOrders: 0, totalDrivers: 0, message: 'No unassigned orders to dispatch' };
  }

  // 2. Get available drivers
  const availableDrivers = await db.select().from(drivers)
    .where(and(
      eq(drivers.tenantId, tenantId),
      eq(drivers.status, 'available'),
    ));

  if (availableDrivers.length === 0) {
    return {
      routes: [],
      unassignedOrderIds: unassignedOrders.map(o => o.id),
      totalOrders: unassignedOrders.length,
      totalDrivers: 0,
      message: 'No available drivers',
    };
  }

  // 3. Get vehicles for capacity constraints
  const vehicleIds = availableDrivers
    .map(d => d.currentVehicleId)
    .filter((id): id is string => id !== null);
  const driverVehicles = vehicleIds.length > 0
    ? await db.select().from(vehicles).where(inArray(vehicles.id, vehicleIds))
    : [];
  const vehicleMap = new Map(driverVehicles.map(v => [v.id, v]));

  // 4. Build routing input
  const driverData = availableDrivers
    .filter(d => d.currentLat && d.currentLng)
    .map(d => {
      const vehicle = d.currentVehicleId ? vehicleMap.get(d.currentVehicleId) : null;
      return {
        id: d.id,
        name: d.name,
        lat: Number(d.currentLat),
        lng: Number(d.currentLng),
        capacity: {
          weight: vehicle?.capacityWeight ? Number(vehicle.capacityWeight) : 0,
          volume: vehicle?.capacityVolume ? Number(vehicle.capacityVolume) : 0,
          count: vehicle?.capacityCount ?? 0,
        },
        vehicleId: d.currentVehicleId,
      };
    });

  if (driverData.length === 0) {
    return {
      routes: [],
      unassignedOrderIds: unassignedOrders.map(o => o.id),
      totalOrders: unassignedOrders.length,
      totalDrivers: availableDrivers.length,
      message: 'No drivers with known locations',
    };
  }

  const orderData = unassignedOrders
    .filter(o => o.deliveryLat && o.deliveryLng)
    .map(o => ({
      id: o.id,
      lat: Number(o.deliveryLat),
      lng: Number(o.deliveryLng),
      demand: {
        weight: o.weight ? Number(o.weight) : 0,
        volume: o.volume ? Number(o.volume) : 0,
        count: o.packageCount ?? 1,
      },
      priority: o.priority || 'normal',
      timeWindow: o.timeWindowStart && o.timeWindowEnd
        ? { start: new Date(o.timeWindowStart), end: new Date(o.timeWindowEnd) }
        : undefined,
    }));

  // 5. Run OSRM + VRP solver
  try {
    const result = await dispatchOrders(driverData, orderData, {
      maxOrdersPerRoute: input.maxOrdersPerRoute,
    });

    // 6. Create draft routes from solver output
    const createdRoutes = [];
    for (const assignment of result.assignments) {
      const driver = driverData.find(d => d.id === assignment.driverId);
      if (!driver || assignment.orderedOrderIds.length === 0) continue;

      const route = await createRoute(tenantId, {
        name: `Auto-dispatch: ${driver.name} (${new Date().toLocaleDateString()})`,
        driverId: driver.id,
        vehicleId: driver.vehicleId || undefined,
        orderIds: assignment.orderedOrderIds,
      });

      const durationMin = Math.round(assignment.totalDuration / 60);
      createdRoutes.push({
        ...route,
        driverName: driver.name,
        estimatedDistance: null,
        reasoning: `Assigned ${assignment.orderedOrderIds.length} orders. Est. duration: ${durationMin} min.${result.usedOsrm ? '' : ' (approximate distances)'}`,
      });
    }

    // Log activity
    await logActivity({
      tenantId,
      userId,
      action: 'auto_dispatch',
      entityType: 'dispatch',
      metadata: {
        routesCreated: createdRoutes.length,
        ordersAssigned: createdRoutes.reduce((sum, r) => sum + r.totalStops, 0),
        totalOrders: unassignedOrders.length,
        totalDrivers: availableDrivers.length,
        usedOsrm: result.usedOsrm,
      },
    });

    // Broadcast dispatch event
    broadcastToTenant(tenantId, 'dispatch:preview', {
      routesCreated: createdRoutes.length,
      timestamp: new Date().toISOString(),
    });

    return {
      routes: createdRoutes,
      unassignedOrderIds: result.unassignedOrderIds,
      totalOrders: unassignedOrders.length,
      totalDrivers: availableDrivers.length,
    };
  } catch (error) {
    return {
      routes: [],
      unassignedOrderIds: unassignedOrders.map(o => o.id),
      totalOrders: unassignedOrders.length,
      totalDrivers: availableDrivers.length,
      message: 'Dispatch optimization failed: ' + (error instanceof Error ? error.message : 'Unknown error'),
    };
  }
}

export async function confirmDispatch(tenantId: string, routeIds: string[], userId?: string) {
  // Transition each draft route to 'planned'
  const results = [];
  for (const routeId of routeIds) {
    const result = await transitionRouteStatus(tenantId, routeId, 'planned', userId);
    results.push(result);
  }

  // Log activity
  await logActivity({
    tenantId,
    userId,
    action: 'dispatch_confirmed',
    entityType: 'dispatch',
    metadata: { routeIds, count: routeIds.length },
  });

  // Broadcast confirmation
  broadcastToTenant(tenantId, 'dispatch:confirmed', {
    routeIds,
    count: routeIds.length,
    timestamp: new Date().toISOString(),
  });

  return results;
}
