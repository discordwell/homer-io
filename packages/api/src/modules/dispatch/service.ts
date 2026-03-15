import { eq, and, inArray, isNull } from 'drizzle-orm';
import { db } from '../../lib/db/index.js';
import { orders } from '../../lib/db/schema/orders.js';
import { drivers } from '../../lib/db/schema/drivers.js';
import { vehicles } from '../../lib/db/schema/vehicles.js';
import { chatWithClaude } from '../../lib/ai/claude.js';
import { createRoute, transitionRouteStatus } from '../routes/service.js';
import { broadcastToTenant } from '../../lib/ws/index.js';
import { logActivity } from '../../lib/activity.js';
import type { AutoDispatchRequest } from '@homer-io/shared';

export async function autoDispatch(tenantId: string, input: AutoDispatchRequest, userId?: string) {
  // 1. Get unassigned orders (status='received', no routeId)
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

  // 3. Get vehicles for drivers that have one assigned
  const vehicleIds = availableDrivers
    .map(d => d.currentVehicleId)
    .filter((id): id is string => id !== null);
  const driverVehicles = vehicleIds.length > 0
    ? await db.select().from(vehicles).where(inArray(vehicles.id, vehicleIds))
    : [];
  const vehicleMap = new Map(driverVehicles.map(v => [v.id, v]));

  // 4. Build Claude prompt with order and driver data
  const orderData = unassignedOrders.map(o => {
    const addr = o.deliveryAddress as Record<string, string> | null;
    return {
      id: o.id,
      address: addr ? [addr.street, addr.city, addr.state, addr.zip].filter(Boolean).join(', ') : 'Unknown',
      lat: o.deliveryLat,
      lng: o.deliveryLng,
      weight: o.weight,
      volume: o.volume,
      priority: o.priority,
      packageCount: o.packageCount,
      timeWindow: o.timeWindowStart && o.timeWindowEnd
        ? `${new Date(o.timeWindowStart).toLocaleTimeString()} - ${new Date(o.timeWindowEnd).toLocaleTimeString()}`
        : null,
    };
  });

  const driverData = availableDrivers.map(d => {
    const vehicle = d.currentVehicleId ? vehicleMap.get(d.currentVehicleId) : null;
    return {
      id: d.id,
      name: d.name,
      lat: d.currentLat,
      lng: d.currentLng,
      skillTags: d.skillTags,
      vehicle: vehicle ? {
        type: vehicle.type,
        maxWeight: vehicle.capacityWeight,
        maxVolume: vehicle.capacityVolume,
        maxPackages: vehicle.capacityCount,
      } : null,
    };
  });

  const systemPrompt = `You are an AI dispatch optimizer for a delivery company. Given a set of unassigned orders and available drivers, create optimal route assignments. Consider:
- Geographic proximity (cluster nearby deliveries)
- Vehicle capacity constraints
- Time windows
- Order priority (urgent orders should be assigned first)
- Driver location relative to delivery areas
- Balance workload across drivers

Return ONLY valid JSON matching this format:
{
  "routes": [
    {
      "driverId": "uuid",
      "driverName": "name",
      "orderIds": ["uuid1", "uuid2"],
      "estimatedDistance": 15.5,
      "reasoning": "Brief explanation"
    }
  ],
  "unassignedOrderIds": ["uuid of orders that couldn't be assigned"]
}`;

  const userMessage = `Please create optimal delivery routes.

ORDERS (${orderData.length} total):
${JSON.stringify(orderData, null, 2)}

DRIVERS (${driverData.length} available):
${JSON.stringify(driverData, null, 2)}

CONSTRAINTS:
- Max orders per route: ${input.maxOrdersPerRoute}
- Prioritize urgent: ${input.prioritizeUrgent}`;

  const response = await chatWithClaude(systemPrompt, [{ role: 'user', content: userMessage }]);

  // Check for no-API-key message
  if (response.includes('AI features require an Anthropic API key')) {
    return {
      routes: [],
      unassignedOrderIds: unassignedOrders.map(o => o.id),
      totalOrders: unassignedOrders.length,
      totalDrivers: availableDrivers.length,
      message: 'Auto-dispatch requires an Anthropic API key. Set ANTHROPIC_API_KEY to enable.',
    };
  }

  // 5. Parse Claude's response
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');

    const parsed = JSON.parse(jsonMatch[0]);

    // 6. Create draft routes from AI output
    const createdRoutes = [];
    for (const routePlan of parsed.routes) {
      // Validate driver exists in our available set
      const driver = availableDrivers.find(d => d.id === routePlan.driverId);
      if (!driver) continue;

      // Validate order IDs exist in the unassigned set
      const validOrderIds = routePlan.orderIds.filter((oid: string) =>
        unassignedOrders.some(o => o.id === oid)
      );
      if (validOrderIds.length === 0) continue;

      const route = await createRoute(tenantId, {
        name: `Auto-dispatch: ${driver.name} (${new Date().toLocaleDateString()})`,
        driverId: driver.id,
        vehicleId: driver.currentVehicleId || undefined,
        orderIds: validOrderIds,
      });

      createdRoutes.push({
        ...route,
        driverName: driver.name,
        estimatedDistance: routePlan.estimatedDistance,
        reasoning: routePlan.reasoning,
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
      },
    });

    // Broadcast dispatch event
    broadcastToTenant(tenantId, 'dispatch:preview', {
      routesCreated: createdRoutes.length,
      timestamp: new Date().toISOString(),
    });

    return {
      routes: createdRoutes,
      unassignedOrderIds: parsed.unassignedOrderIds || [],
      totalOrders: unassignedOrders.length,
      totalDrivers: availableDrivers.length,
    };
  } catch (error) {
    return {
      routes: [],
      unassignedOrderIds: unassignedOrders.map(o => o.id),
      totalOrders: unassignedOrders.length,
      totalDrivers: availableDrivers.length,
      message: 'Failed to parse AI dispatch result: ' + (error instanceof Error ? error.message : 'Unknown error'),
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
