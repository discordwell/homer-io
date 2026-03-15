import { eq, and, sql, ilike, gte, lte, desc, asc, inArray } from 'drizzle-orm';
import type { CreateOrderInput, UpdateOrderStatusInput, PaginationInput } from '@homer-io/shared';
import { db } from '../../lib/db/index.js';
import { orders, orderStatusEnum } from '../../lib/db/schema/orders.js';
import { routes } from '../../lib/db/schema/routes.js';
import { NotFoundError } from '../../lib/errors.js';
import { logActivity } from '../../lib/activity.js';

export async function createOrder(tenantId: string, input: CreateOrderInput) {
  const [order] = await db
    .insert(orders)
    .values({
      tenantId,
      externalId: input.externalId,
      recipientName: input.recipientName,
      recipientPhone: input.recipientPhone,
      recipientEmail: input.recipientEmail,
      pickupAddress: input.pickupAddress,
      deliveryAddress: input.deliveryAddress,
      deliveryLat: input.deliveryAddress.coords?.lat?.toString() ?? null,
      deliveryLng: input.deliveryAddress.coords?.lng?.toString() ?? null,
      packageCount: input.packageCount,
      weight: input.weight?.toString(),
      volume: input.volume?.toString(),
      priority: input.priority,
      timeWindowStart: input.timeWindow?.start ? new Date(input.timeWindow.start) : undefined,
      timeWindowEnd: input.timeWindow?.end ? new Date(input.timeWindow.end) : undefined,
      notes: input.notes,
      requiresSignature: input.requiresSignature,
      requiresPhoto: input.requiresPhoto,
    })
    .returning();
  logActivity({ tenantId, action: 'order_created', entityType: 'order', entityId: order.id });
  return order;
}

export async function listOrders(
  tenantId: string,
  pagination: PaginationInput,
  status?: string,
  search?: string,
  dateFrom?: string,
  dateTo?: string,
  sortBy?: string,
  sortDir?: 'asc' | 'desc',
) {
  const { page, limit } = pagination;
  const offset = (page - 1) * limit;

  const conditions = [eq(orders.tenantId, tenantId)];
  if (status && orderStatusEnum.enumValues.includes(status as any)) {
    conditions.push(eq(orders.status, status as any));
  }
  if (search) {
    const escaped = search.replace(/[%_\\]/g, '\\$&');
    conditions.push(ilike(orders.recipientName, `%${escaped}%`));
  }
  if (dateFrom) {
    conditions.push(gte(orders.createdAt, new Date(dateFrom)));
  }
  if (dateTo) {
    conditions.push(lte(orders.createdAt, new Date(dateTo)));
  }

  const where = and(...conditions);

  // Determine sort column and direction
  const sortColumn = (() => {
    switch (sortBy) {
      case 'recipientName': return orders.recipientName;
      case 'priority': return orders.priority;
      case 'status': return orders.status;
      case 'createdAt':
      default: return orders.createdAt;
    }
  })();
  const orderByClause = sortDir === 'asc' ? asc(sortColumn) : desc(sortColumn);

  const [items, countResult] = await Promise.all([
    db.select().from(orders).where(where)
      .limit(limit).offset(offset)
      .orderBy(orderByClause),
    db.select({ count: sql<number>`count(*)` }).from(orders).where(where),
  ]);

  const total = Number(countResult[0].count);
  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getOrder(tenantId: string, id: string) {
  const [order] = await db.select().from(orders)
    .where(and(eq(orders.id, id), eq(orders.tenantId, tenantId)))
    .limit(1);
  if (!order) throw new NotFoundError('Order not found');
  return order;
}

export async function updateOrderStatus(tenantId: string, id: string, input: UpdateOrderStatusInput) {
  const updates: Record<string, unknown> = {
    status: input.status,
    updatedAt: new Date(),
  };
  if (input.failureReason) updates.failureReason = input.failureReason;
  if (input.notes) updates.notes = input.notes;
  if (input.status === 'delivered' || input.status === 'failed') {
    updates.completedAt = new Date();
  }

  const [order] = await db.update(orders)
    .set(updates)
    .where(and(eq(orders.id, id), eq(orders.tenantId, tenantId)))
    .returning();
  if (!order) throw new NotFoundError('Order not found');
  logActivity({ tenantId, action: 'order_status_updated', entityType: 'order', entityId: id, metadata: { newStatus: input.status } });
  return order;
}

export async function deleteOrder(tenantId: string, id: string) {
  const result = await db.delete(orders)
    .where(and(eq(orders.id, id), eq(orders.tenantId, tenantId)))
    .returning({ id: orders.id });
  if (result.length === 0) throw new NotFoundError('Order not found');
  logActivity({ tenantId, action: 'order_deleted', entityType: 'order', entityId: id });
}

export async function importOrdersCsv(tenantId: string, rows: Array<Record<string, string | undefined>>) {
  const created: Array<typeof orders.$inferSelect> = [];
  const errors: Array<{ row: number; error: string }> = [];

  // Use a transaction so partial imports can be rolled back on catastrophic failure
  await db.transaction(async (tx) => {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const [order] = await tx
          .insert(orders)
          .values({
            tenantId,
            recipientName: row.recipient_name || row.name || 'Unknown',
            recipientPhone: row.phone,
            recipientEmail: row.email || undefined,
            deliveryAddress: {
              street: row.street || row.address || '',
              city: row.city || '',
              state: row.state || '',
              zip: row.zip || row.postal_code || '',
              country: row.country || 'US',
            },
            packageCount: row.packages ? parseInt(row.packages) || 1 : 1,
            notes: row.notes,
            priority: row.priority === 'high' || row.priority === 'urgent' ? row.priority : 'normal',
          })
          .returning();
        created.push(order);
      } catch (err) {
        errors.push({ row: i + 1, error: 'Failed to import row' });
      }
    }
  });

  logActivity({ tenantId, action: 'orders_imported', entityType: 'order', metadata: { count: created.length } });
  return { imported: created.length, errors, total: rows.length };
}

export async function batchUpdateStatus(tenantId: string, orderIds: string[], status: string) {
  // Validate status is a valid enum value
  if (!orderStatusEnum.enumValues.includes(status as any)) {
    throw new NotFoundError('Invalid order status');
  }
  const result = await db.update(orders)
    .set({
      status: status as any,
      updatedAt: new Date(),
      ...(status === 'delivered' || status === 'failed' ? { completedAt: new Date() } : {}),
    })
    .where(and(
      eq(orders.tenantId, tenantId),
      inArray(orders.id, orderIds),
    ))
    .returning({ id: orders.id });

  await logActivity({ tenantId, action: 'batch_status_updated', entityType: 'order', metadata: { count: result.length, newStatus: status } });
  return { updated: result.length };
}

export async function batchAssignToRoute(tenantId: string, orderIds: string[], routeId: string) {
  let sequence = 1;
  // Get current max stop sequence on the route
  const [maxSeq] = await db.select({ max: sql<number>`coalesce(max(${orders.stopSequence}), 0)` })
    .from(orders).where(and(eq(orders.routeId, routeId), eq(orders.tenantId, tenantId)));
  sequence = (maxSeq?.max ?? 0) + 1;

  for (const orderId of orderIds) {
    await db.update(orders).set({
      routeId, stopSequence: sequence++, status: 'assigned' as any, updatedAt: new Date(),
    }).where(and(eq(orders.id, orderId), eq(orders.tenantId, tenantId)));
  }

  // Update route total stops
  const [countResult] = await db.select({ count: sql<number>`count(*)` })
    .from(orders).where(and(eq(orders.routeId, routeId), eq(orders.tenantId, tenantId)));
  await db.update(routes).set({ totalStops: Number(countResult.count), updatedAt: new Date() })
    .where(and(eq(routes.id, routeId), eq(routes.tenantId, tenantId)));

  await logActivity({ tenantId, action: 'batch_assigned', entityType: 'order', metadata: { count: orderIds.length, routeId } });
  return { assigned: orderIds.length };
}
