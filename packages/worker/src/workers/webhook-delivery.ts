import { Job } from 'bullmq';
import { eq, sql } from 'drizzle-orm';
import { createHmac } from 'crypto';
import { db } from '../lib/db.js';
import { webhookEndpoints, webhookDeliveries } from '../lib/schema.js';

interface WebhookDeliveryJobData {
  deliveryId: string;
  endpointId: string;
  tenantId: string;
}

// Retry delays: 30s, 2m, 15m, 1h, 4h
const RETRY_DELAYS = [30_000, 120_000, 900_000, 3_600_000, 14_400_000];

export async function processWebhookDelivery(job: Job<WebhookDeliveryJobData>) {
  const { deliveryId, endpointId } = job.data;

  // Get delivery and endpoint
  const [delivery] = await db.select().from(webhookDeliveries).where(eq(webhookDeliveries.id, deliveryId)).limit(1);
  if (!delivery) return;

  const [endpoint] = await db.select().from(webhookEndpoints).where(eq(webhookEndpoints.id, endpointId)).limit(1);
  if (!endpoint) return;

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

      console.log(`[webhook] Delivered ${delivery.event} to ${endpoint.url}`);
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

    console.error(`[webhook] Failed to deliver ${delivery.event} to ${endpoint.url}: ${errorMsg} (attempt ${attempt}/5)`);

    if (attempt < 5) {
      throw error; // Let BullMQ retry
    }
  }
}
