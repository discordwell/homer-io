import { eq, and, sql, lt, desc, isNull } from 'drizzle-orm';
import type { SendMessageInput, MessageListQuery } from '@homer-io/shared';
import { db } from '../../lib/db/index.js';
import { messages } from '../../lib/db/schema/messages.js';
import { users } from '../../lib/db/schema/users.js';
import { broadcastToTenant } from '../../lib/ws/index.js';

export async function sendMessage(tenantId: string, senderId: string, input: SendMessageInput) {
  const [message] = await db.insert(messages).values({
    tenantId, senderId, routeId: input.routeId ?? null,
    recipientId: input.recipientId ?? null, body: input.body,
    attachmentUrl: input.attachmentUrl ?? null,
  }).returning();

  // Get sender name for broadcast
  const [sender] = await db.select({ name: users.name }).from(users)
    .where(eq(users.id, senderId)).limit(1);

  broadcastToTenant(tenantId, 'message:new', {
    ...message, senderName: sender?.name ?? 'Unknown',
    createdAt: message.createdAt.toISOString(), readAt: null,
  });

  return { ...message, senderName: sender?.name, createdAt: message.createdAt.toISOString(), readAt: null };
}

export async function listMessages(tenantId: string, query: MessageListQuery) {
  const conditions = [eq(messages.tenantId, tenantId)];
  if (query.routeId) conditions.push(eq(messages.routeId, query.routeId));
  if (query.recipientId) conditions.push(eq(messages.recipientId, query.recipientId));
  if (query.cursor) conditions.push(lt(messages.createdAt, new Date(query.cursor)));

  const items = await db.select({
    id: messages.id, routeId: messages.routeId, senderId: messages.senderId,
    recipientId: messages.recipientId, body: messages.body,
    attachmentUrl: messages.attachmentUrl, readAt: messages.readAt,
    createdAt: messages.createdAt, senderName: users.name,
  }).from(messages)
    .leftJoin(users, eq(messages.senderId, users.id))
    .where(and(...conditions))
    .orderBy(desc(messages.createdAt))
    .limit(query.limit || 50);

  return items.map(m => ({
    ...m, createdAt: m.createdAt.toISOString(), readAt: m.readAt?.toISOString() ?? null,
  }));
}

export async function markAsRead(tenantId: string, messageId: string, userId: string) {
  await db.update(messages).set({ readAt: new Date() })
    .where(and(eq(messages.id, messageId), eq(messages.tenantId, tenantId), eq(messages.recipientId, userId)));
  return { success: true };
}

export async function getUnreadCount(tenantId: string, userId: string) {
  const [result] = await db.select({ count: sql<number>`count(*)` }).from(messages)
    .where(and(eq(messages.tenantId, tenantId), eq(messages.recipientId, userId), isNull(messages.readAt)));
  return { count: Number(result.count) };
}
