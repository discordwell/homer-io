import { eq, and, sql } from 'drizzle-orm';
import type { PaginationInput } from '@homer-io/shared';
import { db } from '../../lib/db/index.js';
import { routes, routeStatusEnum } from '../../lib/db/schema/routes.js';
import { orders } from '../../lib/db/schema/orders.js';

interface CreateRouteInput {
  name: string;
  driverId?: string;
  vehicleId?: string;
  depotAddress?: Record<string, unknown>;
  depotLat?: number;
  depotLng?: number;
  plannedStartAt?: string;
  plannedEndAt?: string;
  orderIds?: string[];
}

export async function createRoute(tenantId: string, input: CreateRouteInput) {
  const [route] = await db.transaction(async (tx) => {
    const [newRoute] = await tx
      .insert(routes)
      .values({
        tenantId,
        name: input.name,
        driverId: input.driverId,
        vehicleId: input.vehicleId,
        depotAddress: input.depotAddress,
        depotLat: input.depotLat?.toString(),
        depotLng: input.depotLng?.toString(),
        plannedStartAt: input.plannedStartAt ? new Date(input.plannedStartAt) : undefined,
        plannedEndAt: input.plannedEndAt ? new Date(input.plannedEndAt) : undefined,
        totalStops: input.orderIds?.length ?? 0,
      })
      .returning();

    // Assign orders to route
    if (input.orderIds?.length) {
      for (let i = 0; i < input.orderIds.length; i++) {
        await tx.update(orders)
          .set({
            routeId: newRoute.id,
            stopSequence: i + 1,
            status: 'assigned',
            updatedAt: new Date(),
          })
          .where(and(eq(orders.id, input.orderIds[i]), eq(orders.tenantId, tenantId)));
      }
    }

    return [newRoute];
  });

  return route;
}

export async function listRoutes(tenantId: string, pagination: PaginationInput, status?: string) {
  const { page, limit } = pagination;
  const offset = (page - 1) * limit;

  const conditions = [eq(routes.tenantId, tenantId)];
  if (status && routeStatusEnum.enumValues.includes(status as any)) {
    conditions.push(eq(routes.status, status as any));
  }

  const where = and(...conditions);

  const [items, countResult] = await Promise.all([
    db.select().from(routes).where(where)
      .limit(limit).offset(offset)
      .orderBy(routes.createdAt),
    db.select({ count: sql<number>`count(*)` }).from(routes).where(where),
  ]);

  const total = Number(countResult[0].count);
  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getRoute(tenantId: string, id: string) {
  const [route] = await db.select().from(routes)
    .where(and(eq(routes.id, id), eq(routes.tenantId, tenantId)))
    .limit(1);
  if (!route) throw new Error('Route not found');

  // Get associated orders
  const routeOrders = await db.select().from(orders)
    .where(and(eq(orders.routeId, id), eq(orders.tenantId, tenantId)))
    .orderBy(orders.stopSequence);

  return { ...route, orders: routeOrders };
}

export async function updateRoute(tenantId: string, id: string, input: Partial<CreateRouteInput>) {
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (input.name !== undefined) updates.name = input.name;
  if (input.driverId !== undefined) updates.driverId = input.driverId;
  if (input.vehicleId !== undefined) updates.vehicleId = input.vehicleId;

  const [route] = await db.update(routes)
    .set(updates)
    .where(and(eq(routes.id, id), eq(routes.tenantId, tenantId)))
    .returning();
  if (!route) throw new Error('Route not found');
  return route;
}

export async function deleteRoute(tenantId: string, id: string) {
  await db.transaction(async (tx) => {
    // Unassign orders
    await tx.update(orders)
      .set({ routeId: null, stopSequence: null, status: 'received', updatedAt: new Date() })
      .where(and(eq(orders.routeId, id), eq(orders.tenantId, tenantId)));

    const result = await tx.delete(routes)
      .where(and(eq(routes.id, id), eq(routes.tenantId, tenantId)))
      .returning({ id: routes.id });
    if (result.length === 0) throw new Error('Route not found');
  });
}

export async function optimizeRoute(tenantId: string, routeId: string) {
  // Get route with orders
  const routeData = await getRoute(tenantId, routeId);

  if (routeData.orders.length === 0) {
    return { message: 'No orders to optimize', route: routeData };
  }

  // TODO: Integrate with AI optimization (Claude API / OR-Tools)
  // For now, return the route as-is with a placeholder message
  return {
    message: 'Route optimization will be available when AI service is configured',
    route: routeData,
    optimized: false,
  };
}
