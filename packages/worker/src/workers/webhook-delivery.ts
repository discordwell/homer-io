import { Queue, type Job } from 'bullmq';
import { eq, and, sql } from 'drizzle-orm';
import { createHmac } from 'crypto';
import { db } from '../lib/db.js';
import { webhookEndpoints, webhookDeliveries } from '../lib/schema.js';
import { logger } from '../lib/logger.js';
import { config } from '../lib/config.js';

interface WebhookDeliveryJobData {
  deliveryId: string;
  endpointId: string;
  tenantId: string;
}

// Retry backoff ladder. At WEBHOOK_MAX_ATTEMPTS = 5 (1 initial + 4 retries) the
// reachable delays are 30s → 2m → 15m → 1h; the 4h tail is reserved headroom.
const RETRY_DELAYS = [30_000, 120_000, 900_000, 3_600_000, 14_400_000];

export const WEBHOOK_MAX_ATTEMPTS = 5;

// Retries are driven here, not by BullMQ's `attempts` option: the API enqueues
// each delivery with attempts:1, so on failure the worker re-enqueues a delayed
// job through this queue. (A previous version threw "to let BullMQ retry" while
// attempts was 1 — so a job that failed its single attempt was dead-lettered and
// transient failures were silently never retried, the whole ladder dead code.)
const webhookQueue = new Queue('webhook-delivery', { connection: { url: config.redis.url } });

const log = logger.child({ worker: 'webhook-delivery' });

/**
 * Delay (ms) before the next delivery attempt, or null when the retry ladder is
 * exhausted. `attempt` is the 1-based number of the attempt that just failed:
 * 1 → 30s, 2 → 2m, 3 → 15m, 4 → 1h; attempt >= WEBHOOK_MAX_ATTEMPTS → null (give up).
 */
export function nextRetryDelayMs(attempt: number): number | null {
  if (attempt >= WEBHOOK_MAX_ATTEMPTS) return null;
  return RETRY_DELAYS[Math.min(attempt - 1, RETRY_DELAYS.length - 1)];
}

// Block SSRF at delivery time: defense-in-depth against DNS-rebinding between
// create-time validation and the actual HTTP request. This is the sync /
// literal-IP form of the API's assertUrlIsSafe helper (see
// packages/api/src/lib/safe-url.ts — keep the two in sync). DNS can change
// between create-time and delivery-time (TOCTOU), so we intentionally do NOT
// re-do the full DNS resolution here; we reject the obvious SSRF targets
// synchronously and let Node's network stack handle the rest.
function isBlockedUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    if (url.protocol !== 'https:') return true;
    if (url.username || url.password) return true;
    const hostnameRaw = url.hostname.trim().toLowerCase();
    if (!hostnameRaw) return true;
    const hostname = hostnameRaw.startsWith('[') && hostnameRaw.endsWith(']')
      ? hostnameRaw.slice(1, -1)
      : hostnameRaw;

    // Named loopback / metadata targets.
    if (
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname === 'ip6-localhost' ||
      hostname === 'ip6-loopback' ||
      hostname === 'metadata.google.internal' ||
      hostname === 'metadata.goog'
    ) return true;

    // IPv4 literal.
    const v4 = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (v4) {
      const [a, b, c, d] = [1, 2, 3, 4].map(i => Number(v4[i]));
      if ([a, b, c, d].some(n => Number.isNaN(n) || n < 0 || n > 255)) return true;
      if (a === 0) return true;                                              // 0.0.0.0/8
      if (a === 10) return true;                                             // RFC1918
      if (a === 100 && b >= 64 && b <= 127) return true;                     // CGNAT
      if (a === 127) return true;                                            // loopback
      if (a === 169 && b === 254) return true;                               // link-local / AWS metadata
      if (a === 172 && b >= 16 && b <= 31) return true;                      // RFC1918
      if (a === 192 && b === 0 && (c === 0 || c === 2)) return true;         // protocol / TEST-NET-1
      if (a === 192 && b === 168) return true;                               // RFC1918
      if (a === 198 && (b === 18 || b === 19)) return true;                  // benchmarking
      if (a === 198 && b === 51 && c === 100) return true;                   // TEST-NET-2
      if (a === 203 && b === 0 && c === 113) return true;                    // TEST-NET-3
      if (a >= 224 && a <= 239) return true;                                 // multicast
      if (a >= 240) return true;                                             // reserved / 255.255.255.255
      return false;
    }

    // IPv6 literal.
    if (hostname.includes(':')) {
      if (hostname === '::' || hostname === '::1') return true;
      if (/^fe[89ab][0-9a-f]?:/.test(hostname)) return true;                 // fe80::/10 link-local
      if (/^f[cd][0-9a-f]{0,2}:/.test(hostname)) return true;                // fc00::/7 ULA
      if (/^ff[0-9a-f]{0,2}:/.test(hostname)) return true;                   // ff00::/8 multicast
      const mapped = hostname.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
      if (mapped) {
        // Reuse the same v4 test via a recursive synthetic URL.
        return isBlockedUrl(`https://${mapped[1]}`);
      }
      return false;
    }

    return false;
  } catch {
    return true;
  }
}

export async function processWebhookDelivery(job: Job<WebhookDeliveryJobData>) {
  const { deliveryId, endpointId, tenantId } = job.data;

  // Get delivery and endpoint — enforce tenant isolation
  const [delivery] = await db.select().from(webhookDeliveries)
    .where(and(eq(webhookDeliveries.id, deliveryId), eq(webhookDeliveries.tenantId, tenantId)))
    .limit(1);
  if (!delivery) return;

  const [endpoint] = await db.select().from(webhookEndpoints)
    .where(and(eq(webhookEndpoints.id, endpointId), eq(webhookEndpoints.tenantId, tenantId)))
    .limit(1);
  if (!endpoint) return;

  // SSRF protection: block internal/private URLs
  if (isBlockedUrl(endpoint.url)) {
    log.error('Blocked SSRF attempt', { url: endpoint.url, deliveryId });
    // Terminal failure: a blocked target won't become deliverable on retry, so
    // mark the ladder exhausted (attempts at the cap) and do not re-enqueue.
    await db.update(webhookDeliveries).set({
      status: 'failed',
      attempts: WEBHOOK_MAX_ATTEMPTS,
      responseBody: 'Blocked: URL targets a private or internal address',
    }).where(eq(webhookDeliveries.id, deliveryId));
    return;
  }

  const payload = JSON.stringify(delivery.payload);

  // HMAC-SHA256 signature
  const signature = createHmac('sha256', endpoint.secret).update(payload).digest('hex');

  try {
    const response = await fetch(endpoint.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Homer-Signature': signature,
        'X-Homer-Event': delivery.event,
        'X-Homer-Delivery-Id': delivery.id,
        'User-Agent': 'HOMER.io-Webhooks/1.0',
      },
      body: payload,
      signal: AbortSignal.timeout(30_000),
    });

    const responseBody = await response.text().catch(() => '');
    const truncatedBody = responseBody.slice(0, 1000);

    if (response.ok) {
      // Success
      await db.update(webhookDeliveries).set({
        status: 'success',
        httpStatus: response.status,
        responseBody: truncatedBody,
        attempts: (delivery.attempts || 0) + 1,
      }).where(eq(webhookDeliveries.id, deliveryId));

      await db.update(webhookEndpoints).set({
        lastSuccessAt: new Date(),
        failureCount: 0,
        updatedAt: new Date(),
      }).where(eq(webhookEndpoints.id, endpointId));

      log.info('Webhook delivered', { event: delivery.event, url: endpoint.url, deliveryId });
    } else {
      throw new Error(`HTTP ${response.status}: ${truncatedBody}`);
    }
  } catch (error) {
    const attempt = (delivery.attempts || 0) + 1;
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';

    // Schedule the next attempt. delayMs is null once the ladder is exhausted,
    // which both marks the delivery failed and stops re-enqueuing. Reusing the
    // same delayMs for the persisted nextRetryAt and the BullMQ delay keeps the
    // advertised retry time and the actual one identical.
    const delayMs = nextRetryDelayMs(attempt);
    const nextRetryAt = delayMs !== null ? new Date(Date.now() + delayMs) : null;

    await db.update(webhookDeliveries).set({
      status: delayMs !== null ? 'pending' : 'failed',
      attempts: attempt,
      responseBody: errorMsg.slice(0, 1000),
      nextRetryAt,
    }).where(eq(webhookDeliveries.id, deliveryId));

    // Update endpoint failure tracking
    await db.update(webhookEndpoints).set({
      lastFailureAt: new Date(),
      failureCount: sql`${webhookEndpoints.failureCount} + 1`,
      updatedAt: new Date(),
    }).where(eq(webhookEndpoints.id, endpointId));

    log.error('Webhook delivery failed', {
      event: delivery.event,
      url: endpoint.url,
      error: errorMsg,
      attempt,
      maxAttempts: WEBHOOK_MAX_ATTEMPTS,
      deliveryId,
      willRetryInMs: delayMs,
    });

    if (delayMs !== null) {
      // Re-enqueue as a delayed job to drive the retry ladder. We intentionally
      // do NOT rethrow: with attempts:1 a throw dead-letters the job instead of
      // retrying it.
      await webhookQueue.add('deliver', { deliveryId, endpointId, tenantId }, { delay: delayMs });
    }
  }
}
