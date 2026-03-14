import { eq, and, sql } from 'drizzle-orm';
import type { PaginationInput, CreateRouteInput } from '@homer-io/shared';
import { db } from '../../lib/db/index.js';
import { routes, routeStatusEnum } from '../../lib/db/schema/routes.js';
import { orders } from '../../lib/db/schema/orders.js';
import { NotFoundError } from '../../lib/errors.js';

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
  if (!route) throw new NotFoundError('Route not found');

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
  if (!route) throw new NotFoundError('Route not found');
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
    if (result.length === 0) throw new NotFoundError('Route not found');
  });
}

export async function optimizeRoute(tenantId: string, routeId: string) {
  // Get route with orders
  const routeData = await getRoute(tenantId, routeId);

  if (routeData.orders.length === 0) {
    return { message: 'No orders to optimize', route: routeData };
  }

  // Build a prompt with stop addresses
  const stops = routeData.orders.map((order, idx) => {
    const addr = order.deliveryAddress as Record<string, string> | null;
    const addressStr = addr
      ? [addr.street, addr.city, addr.state, addr.zip].filter(Boolean).join(', ')
      : `Stop ${idx + 1}`;
    return `${idx}: ${addressStr}`;
  });

  const prompt =
    `I have a delivery route with the following stops (index: address):\n${stops.join('\n')}\n\n` +
    `Please determine the optimal order to visit these stops to minimize total travel distance. ` +
    `Return ONLY a JSON array of the stop indices in optimal order, e.g. [2, 0, 1, 3]. No other text.`;

  try {
    const { chatWithClaude } = await import('../../lib/ai/claude.js');
    const response = await chatWithClaude(
      'You are a route optimization assistant. Return only valid JSON arrays of indices.',
      [{ role: 'user', content: prompt }],
    );

    // Check if the response is the "no API key" message
    if (response.includes('AI features require an Anthropic API key')) {
      return {
        message: 'Route optimization requires an Anthropic API key. Set ANTHROPIC_API_KEY to enable.',
        route: routeData,
        optimized: false,
      };
    }

    // Parse the response to get ordered stop indices
    const jsonMatch = response.match(/\[[\d,\s]+\]/);
    if (!jsonMatch) {
      return {
        message: 'Could not parse optimization result',
        route: routeData,
        optimized: false,
      };
    }

    const orderedIndices: number[] = JSON.parse(jsonMatch[0]);

    // Validate indices — check length, range, and no duplicates
    const uniqueIndices = new Set(orderedIndices);
    if (orderedIndices.length !== routeData.orders.length ||
        uniqueIndices.size !== orderedIndices.length ||
        !orderedIndices.every((i) => i >= 0 && i < routeData.orders.length)) {
      return {
        message: 'Invalid optimization result from AI',
        route: routeData,
        optimized: false,
      };
    }

    // Update stopSequence on orders in a transaction
    await db.transaction(async (tx) => {
      for (let newSeq = 0; newSeq < orderedIndices.length; newSeq++) {
        const originalIdx = orderedIndices[newSeq];
        const order = routeData.orders[originalIdx];
        await tx.update(orders)
          .set({ stopSequence: newSeq + 1, updatedAt: new Date() })
          .where(and(eq(orders.id, order.id), eq(orders.tenantId, tenantId)));
      }

      await tx.update(routes)
        .set({
          optimizationNotes: `AI-optimized on ${new Date().toISOString()}. Order: ${orderedIndices.join(' -> ')}`,
          updatedAt: new Date(),
        })
        .where(and(eq(routes.id, routeId), eq(routes.tenantId, tenantId)));
    });

    // Re-fetch the updated route
    const updatedRoute = await getRoute(tenantId, routeId);
    return {
      message: 'Route optimized successfully',
      route: updatedRoute,
      optimized: true,
    };
  } catch (error) {
    return {
      message: 'Route optimization failed: ' + (error instanceof Error ? error.message : 'Unknown error'),
      route: routeData,
      optimized: false,
    };
  }
}
