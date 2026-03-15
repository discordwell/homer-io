import { eq, and, desc } from 'drizzle-orm';
import { Queue } from 'bullmq';
import { randomBytes, createHash } from 'crypto';
import { db } from '../../lib/db/index.js';
import { dataExportRequests, dataDeletionRequests } from '../../lib/db/schema/data-requests.js';
import { HttpError, NotFoundError } from '../../lib/errors.js';
import { config } from '../../config.js';
import { sendTransactionalEmail } from '../../lib/email.js';
import { users } from '../../lib/db/schema/users.js';

const dataExportQueue = new Queue('data-export', { connection: { url: config.redis.url } });

export async function requestDataExport(tenantId: string, userId: string) {
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

export async function listExportRequests(tenantId: string) {
  return db.select().from(dataExportRequests)
    .where(eq(dataExportRequests.tenantId, tenantId))
    .orderBy(desc(dataExportRequests.createdAt));
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
    sendTransactionalEmail(user.email, 'Confirm Account Deletion - HOMER.io',
      `<h2>Account Deletion Requested</h2>
       <p>You requested to delete your HOMER.io account. This will be processed after a 30-day grace period (${scheduledAt.toLocaleDateString()}).</p>
       <p>To confirm, click <a href="${config.app.frontendUrl}/dashboard/settings?confirm-delete=${token}">here</a>.</p>
       <p>To cancel, go to Settings > Privacy in your dashboard.</p>`
    ).catch(err => console.error('[gdpr] deletion email failed:', err));
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
      eq(dataDeletionRequests.status, 'pending'),
    )).returning({ id: dataDeletionRequests.id });
  // Also try confirmed
  const result2 = await db.delete(dataDeletionRequests)
    .where(and(
      eq(dataDeletionRequests.tenantId, tenantId),
      eq(dataDeletionRequests.status, 'confirmed'),
    )).returning({ id: dataDeletionRequests.id });
  if (result.length === 0 && result2.length === 0) throw new NotFoundError('No active deletion request found');
  return { success: true };
}

export async function listDeletionRequests(tenantId: string) {
  return db.select().from(dataDeletionRequests)
    .where(eq(dataDeletionRequests.tenantId, tenantId))
    .orderBy(desc(dataDeletionRequests.createdAt));
}
