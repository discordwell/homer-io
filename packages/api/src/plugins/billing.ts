import { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../lib/db/index.js';
import { subscriptions } from '../lib/db/schema/subscriptions.js';

// Paths that skip billing enforcement (match against full URL path)
const SKIP_PREFIXES = ['/api/auth', '/api/public', '/api/billing', '/health', '/stripe'];
const GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function requireActiveSubscription(request: FastifyRequest, reply: FastifyReply) {
  // Skip billing check for certain route prefixes
  const path = request.url.split('?')[0];
  if (SKIP_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    return;
  }

  // Must be authenticated first (user set by auth preHandler)
  if (!request.user?.tenantId) {
    return;
  }

  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.tenantId, request.user.tenantId))
    .limit(1);

  // No subscription record — allow (new tenant may not have one yet)
  if (!sub) {
    return;
  }

  const now = new Date();

  // trialing — check if trial is still valid
  if (sub.status === 'trialing') {
    if (sub.trialEndsAt && sub.trialEndsAt > now) {
      return; // Trial still active
    }
    // Trial expired — fall through to block mutations
  }

  // active — always allow
  if (sub.status === 'active') {
    return;
  }

  // past_due — allow with warning header for 7-day grace period
  if (sub.status === 'past_due') {
    reply.header('X-Billing-Warning', 'past_due');
    const periodEnd = sub.currentPeriodEnd?.getTime() ?? now.getTime();
    if (now.getTime() - periodEnd < GRACE_PERIOD_MS) {
      return; // Within grace period
    }
    // Grace period expired — fall through to block mutations
  }

  // canceled, unpaid, or expired trial/past_due — read-only mode
  // Allow GET requests, block mutations
  if (request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS') {
    reply.header('X-Billing-Warning', sub.status);
    return;
  }

  // Block mutation requests
  return reply.code(402).send({
    message: 'Your subscription is inactive. Please update your billing to continue.',
    status: sub.status,
    readOnly: true,
  });
}
