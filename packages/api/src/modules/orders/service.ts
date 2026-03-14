import { eq, and, sql } from 'drizzle-orm';
import type { CreateOrderInput, UpdateOrderStatusInput, PaginationInput } from '@homer-io/shared';
import { db } from '../../lib/db/index.js';
import { orders, orderStatusEnum } from '../../lib/db/schema/orders.js';

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
      deliveryLat: input.deliveryAddress.coords?.lat.toString(),
      deliveryLng: input.deliveryAddress.coords?.lng.toString(),
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
  return order;
}

export async function listOrders(tenantId: string, pagination: PaginationInput, status?: string) {
  const { page, limit } = pagination;
  const offset = (page - 1) * limit;

  const conditions = [eq(orders.tenantId, tenantId)];
  if (status && orderStatusEnum.enumValues.includes(status as any)) {
    conditions.push(eq(orders.status, status as any));
  }

  const where = and(...conditions);

  const [items, countResult] = await Promise.all([
    db.select().from(orders).where(where)
      .limit(limit).offset(offset)
      .orderBy(orders.createdAt),
    db.select({ count: sql<number>`count(*)` }).from(orders).where(where),
  ]);

  const total = Number(countResult[0].count);
  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getOrder(tenantId: string, id: string) {
  const [order] = await db.select().from(orders)
    .where(and(eq(orders.id, id), eq(orders.tenantId, tenantId)))
    .limit(1);
  if (!order) throw new Error('Order not found');
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
  if (!order) throw new Error('Order not found');
  return order;
}

export async function deleteOrder(tenantId: string, id: string) {
  const result = await db.delete(orders)
    .where(and(eq(orders.id, id), eq(orders.tenantId, tenantId)))
    .returning({ id: orders.id });
  if (result.length === 0) throw new Error('Order not found');
}

export async function importOrdersCsv(tenantId: string, rows: Array<Record<string, string>>) {
  const created: Array<typeof orders.$inferSelect> = [];
  const errors: Array<{ row: number; error: string }> = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const [order] = await db
        .insert(orders)
        .values({
          tenantId,
          recipientName: row.recipient_name || row.name || 'Unknown',
          recipientPhone: row.phone,
          recipientEmail: row.email,
          deliveryAddress: {
            street: row.street || row.address || '',
            city: row.city || '',
            state: row.state || '',
            zip: row.zip || row.postal_code || '',
            country: row.country || 'US',
          },
          packageCount: row.packages ? parseInt(row.packages) : 1,
          notes: row.notes,
          priority: row.priority === 'high' || row.priority === 'urgent' ? row.priority : 'normal',
        })
        .returning();
      created.push(order);
    } catch (err) {
      errors.push({ row: i + 1, error: String(err) });
    }
  }

  return { imported: created.length, errors, total: rows.length };
}
