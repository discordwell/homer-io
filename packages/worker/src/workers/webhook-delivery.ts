import type { Job } from 'bullmq';
import { eq, and, sql } from 'drizzle-orm';
import { createHmac } from 'crypto';
import { db } from '../lib/db.js';
import { webhookEndpoints, webhookDeliveries } from '../lib/schema.js';
import { logger } from '../lib/logger.js';

interface WebhookDeliveryJobData {
  deliveryId: string;
  endpointId: string;
  tenantId: string;
}

// Retry delays: 30s, 2m, 15m, 1h, 4h
const RETRY_DELAYS = [30_000, 120_000, 900_000, 3_600_000, 14_400_000];

const log = logger.child({ worker: 'webhook-delivery' });

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
    await db.update(webhookDeliveries).set({
      status: 'failed',
      attempts: 5,
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

    // Calculate next retry
    const retryIndex = Math.min(attempt - 1, RETRY_DELAYS.length - 1);
    const nextRetryAt = attempt < 5 ? new Date(Date.now() + RETRY_DELAYS[retryIndex]) : null;

    await db.update(webhookDeliveries).set({
      status: attempt >= 5 ? 'failed' : 'pending',
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
      maxAttempts: 5,
      deliveryId,
    });

    if (attempt < 5) {
      throw error; // Let BullMQ retry
    }
  }
}
