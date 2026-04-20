import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import type { PaginationInput } from '@homer-io/shared';
import { Queue } from 'bullmq';
import { randomBytes, createHash } from 'crypto';
import { db } from '../../lib/db/index.js';
import { dataExportRequests, dataDeletionRequests } from '../../lib/db/schema/data-requests.js';
import { HttpError, NotFoundError } from '../../lib/errors.js';
import { config } from '../../config.js';
import { sendTransactionalEmail, escapeHtml } from '../../lib/email.js';
import { users } from '../../lib/db/schema/users.js';
import { logger } from '../../lib/logger.js';

const dataExportQueue = new Queue('data-export', { connection: { url: config.redis.url } });

/**
 * Statuses considered "in progress" — a tenant cannot queue a new export while
 * one of these is outstanding. This gates resource exhaustion at the tenant
 * level (storage quota, worker capacity) on top of the per-user rate limiter.
 */
const IN_PROGRESS_EXPORT_STATUSES = ['queued', 'processing'] as const;

export async function requestDataExport(tenantId: string, userId: string) {
  // Tenant-scoped guard: if there's already a queued or processing export for
  // this tenant, refuse to enqueue a duplicate. This complements the per-user
  // Fastify rate limiter (1/hour) and protects against pathological cases
  // where different owner accounts in the same tenant could each queue jobs.
  const [pending] = await db.select({ id: dataExportRequests.id, status: dataExportRequests.status })
    .from(dataExportRequests)
    .where(and(
      eq(dataExportRequests.tenantId, tenantId),
      inArray(dataExportRequests.status, [...IN_PROGRESS_EXPORT_STATUSES]),
    ))
    .orderBy(desc(dataExportRequests.createdAt))
    .limit(1);
  if (pending) {
    throw new HttpError(409, 'Export already in progress');
  }

  const [request] = await db.insert(dataExportRequests).values({
    tenantId, requestedBy: userId, status: 'queued',
  }).returning();
  await dataExportQueue.add('export', { tenantId, exportId: request.id });
  return request;
}

export async function getExportStatus(tenantId: string, exportId: string) {
  const [request] = await db.select().from(dataExportRequests)
    .where(and(eq(dataExportRequests.id, exportId), eq(dataExportRequests.tenantId, tenantId))).limit(1);
  if (!request) throw new NotFoundError('Export request not found');
  return request;
}

export async function listExportRequests(tenantId: string, pagination: PaginationInput) {
  const { page, limit } = pagination;
  const offset = (page - 1) * limit;
  const where = eq(dataExportRequests.tenantId, tenantId);

  const [items, countResult] = await Promise.all([
    db.select().from(dataExportRequests)
      .where(where)
      .orderBy(desc(dataExportRequests.createdAt))
      .limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(dataExportRequests).where(where),
  ]);

  const total = Number(countResult[0]?.count ?? 0);
  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function requestAccountDeletion(tenantId: string, userId: string, confirmPhrase: string) {
  if (confirmPhrase !== 'DELETE MY ACCOUNT') {
    throw new HttpError(400, 'Please type "DELETE MY ACCOUNT" to confirm');
  }
  // Check for existing pending request
  const [existing] = await db.select().from(dataDeletionRequests)
    .where(and(eq(dataDeletionRequests.tenantId, tenantId), eq(dataDeletionRequests.status, 'pending'))).limit(1);
  if (existing) throw new HttpError(409, 'A deletion request is already pending');

  const token = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const scheduledAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  const [request] = await db.insert(dataDeletionRequests).values({
    tenantId, requestedBy: userId, status: 'pending',
    confirmationToken: tokenHash, scheduledAt,
  }).returning();

  // Send confirmation email
  const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
  if (user) {
    const safeUrl = escapeHtml(`${config.app.frontendUrl}/dashboard/settings?confirm-delete=${token}`);
    sendTransactionalEmail(user.email, 'Confirm Account Deletion - HOMER.io',
      `<h2>Account Deletion Requested</h2>
       <p>You requested to delete your HOMER.io account. This will be processed after a 30-day grace period (${escapeHtml(scheduledAt.toLocaleDateString())}).</p>
       <p>To confirm, click <a href="${safeUrl}">here</a>.</p>
       <p>To cancel, go to Settings &gt; Privacy in your dashboard.</p>`
    ).catch(err => logger.error({ err, tenantId, userId }, '[gdpr] deletion email failed'));
  }

  return { ...request, scheduledAt: scheduledAt.toISOString() };
}

export async function confirmDeletion(tenantId: string, token: string) {
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const [request] = await db.select().from(dataDeletionRequests)
    .where(and(eq(dataDeletionRequests.confirmationToken, tokenHash), eq(dataDeletionRequests.tenantId, tenantId))).limit(1);
  if (!request || request.status !== 'pending') throw new HttpError(400, 'Invalid or expired confirmation token');
  await db.update(dataDeletionRequests).set({ status: 'confirmed' })
    .where(eq(dataDeletionRequests.id, request.id));
  return { success: true, scheduledAt: request.scheduledAt?.toISOString() };
}

export async function cancelDeletion(tenantId: string) {
  const result = await db.delete(dataDeletionRequests)
    .where(and(
      eq(dataDeletionRequests.tenantId, tenantId),
      inArray(dataDeletionRequests.status, ['pending', 'confirmed']),
    )).returning({ id: dataDeletionRequests.id });
  if (result.length === 0) throw new NotFoundError('No active deletion request found');
  return { success: true };
}

export async function listDeletionRequests(tenantId: string, pagination: PaginationInput) {
  const { page, limit } = pagination;
  const offset = (page - 1) * limit;
  const where = eq(dataDeletionRequests.tenantId, tenantId);

  const [items, countResult] = await Promise.all([
    db.select().from(dataDeletionRequests)
      .where(where)
      .orderBy(desc(dataDeletionRequests.createdAt))
      .limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(dataDeletionRequests).where(where),
  ]);

  const total = Number(countResult[0]?.count ?? 0);
  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}
