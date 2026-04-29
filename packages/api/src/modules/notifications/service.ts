import { eq, and, isNull, desc, sql, count } from 'drizzle-orm';
import type { NotificationType } from '@homer-io/shared';
import { db } from '../../lib/db/index.js';
import { notifications } from '../../lib/db/schema/notifications.js';

interface CreateNotificationParams {
  tenantId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export async function createNotification(params: CreateNotificationParams) {
  const [notification] = await db
    .insert(notifications)
    .values({
      tenantId: params.tenantId,
      userId: params.userId,
      type: params.type,
      title: params.title,
      body: params.body,
      data: params.data ?? {},
    })
    .returning();

  return {
    ...notification,
    readAt: notification.readAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString(),
  };
}

export async function listNotifications(
  tenantId: string,
  userId: string,
  pagination: { page: number; limit: number },
  readFilter?: boolean,
) {
  const conditions = [
    eq(notifications.tenantId, tenantId),
    eq(notifications.userId, userId),
  ];

  if (readFilter === true) {
    conditions.push(sql`${notifications.readAt} IS NOT NULL`);
  } else if (readFilter === false) {
    conditions.push(isNull(notifications.readAt));
  }

  const where = and(...conditions);

  const [totalResult] = await db
    .select({ count: count() })
    .from(notifications)
    .where(where);

  const total = totalResult.count;
  const totalPages = Math.ceil(total / pagination.limit) || 1;
  const offset = (pagination.page - 1) * pagination.limit;

  const items = await db
    .select()
    .from(notifications)
    .where(where)
    .orderBy(desc(notifications.createdAt))
    .limit(pagination.limit)
    .offset(offset);

  return {
    items: items.map(n => ({
      ...n,
      readAt: n.readAt?.toISOString() ?? null,
      createdAt: n.createdAt.toISOString(),
    })),
    total,
    page: pagination.page,
    limit: pagination.limit,
    totalPages,
  };
}

export async function getUnreadCount(tenantId: string, userId: string) {
  const [result] = await db
    .select({ count: count() })
    .from(notifications)
    .where(
      and(
        eq(notifications.tenantId, tenantId),
        eq(notifications.userId, userId),
        isNull(notifications.readAt),
      ),
    );

  return result.count;
}

export async function markAsRead(
  tenantId: string,
  userId: string,
  notificationId: string,
) {
  const [updated] = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.tenantId, tenantId),
        eq(notifications.userId, userId),
      ),
    )
    .returning();

  if (!updated) {
    return null;
  }

  return {
    ...updated,
    readAt: updated.readAt?.toISOString() ?? null,
    createdAt: updated.createdAt.toISOString(),
  };
}

export async function markAllAsRead(tenantId: string, userId: string) {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.tenantId, tenantId),
        eq(notifications.userId, userId),
        isNull(notifications.readAt),
      ),
    );

  return { success: true };
}
