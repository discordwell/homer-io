import { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../lib/db/index.js';
import { subscriptions } from '../lib/db/schema/subscriptions.js';
import { cacheGet, cacheSet } from '../lib/cache.js';

// Paths that skip billing enforcement (match against full URL path)
const SKIP_PREFIXES = ['/api/auth', '/api/public', '/api/billing', '/health', '/stripe'];
const GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const BILLING_CACHE_TTL = 60; // Cache subscription status for 60 seconds

interface CachedSubStatus {
  status: string;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
}

async function getSubscriptionStatus(tenantId: string): Promise<CachedSubStatus | null> {
  const cacheKey = `billing:status:${tenantId}`;

  // Try cache first
  const cached = await cacheGet<CachedSubStatus>(cacheKey);
  if (cached) return cached;

  const [sub] = await db
    .select({
      status: subscriptions.status,
      trialEndsAt: subscriptions.trialEndsAt,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
    })
    .from(subscriptions)
    .where(eq(subscriptions.tenantId, tenantId))
    .limit(1);

  if (!sub) return null;

  const result: CachedSubStatus = {
    status: sub.status,
    trialEndsAt: sub.trialEndsAt?.toISOString() ?? null,
    currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
  };

  // Cache for 60 seconds — webhook updates will be reflected within a minute
  await cacheSet(cacheKey, result, BILLING_CACHE_TTL);

  return result;
}

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

  const sub = await getSubscriptionStatus(request.user.tenantId);

  // No subscription record — allow (new tenant may not have one yet)
  if (!sub) {
    return;
  }

  const now = new Date();

  // trialing — check if trial is still valid
  if (sub.status === 'trialing') {
    // If no trial end date set, treat as an indefinite trial (allow)
    if (!sub.trialEndsAt || new Date(sub.trialEndsAt) > now) {
      return; // Trial still active (or no expiry set)
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
    const periodEnd = sub.currentPeriodEnd
      ? new Date(sub.currentPeriodEnd).getTime()
      : now.getTime();
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
