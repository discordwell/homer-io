import { eq, and } from 'drizzle-orm';
import { Queue } from 'bullmq';
import { db } from './db/index.js';
import { webhookEndpoints } from './db/schema/webhook-endpoints.js';
import { webhookDeliveries } from './db/schema/webhook-deliveries.js';
import { config } from '../config.js';

const webhookQueue = new Queue('webhook-delivery', { connection: { url: config.redis.url } });

export async function enqueueWebhook(tenantId: string, event: string, payload: Record<string, unknown>) {
  // Find all active endpoints for this tenant
  const endpoints = await db.select().from(webhookEndpoints)
    .where(and(
      eq(webhookEndpoints.tenantId, tenantId),
      eq(webhookEndpoints.isActive, true),
    ));

  // Filter to endpoints whose events array matches the incoming event
  const matchingEndpoints = endpoints.filter(ep => {
    const events = ep.events as string[];
    return events.some(pattern => {
      if (pattern === event) return true;
      // Support wildcard: "order.*" matches "order.created"
      if (pattern.endsWith('.*')) {
        const prefix = pattern.slice(0, -2);
        return event.startsWith(prefix + '.');
      }
      return false;
    });
  });

  // Create delivery records and enqueue jobs for each matching endpoint
  for (const endpoint of matchingEndpoints) {
    const [delivery] = await db.insert(webhookDeliveries).values({
      tenantId,
      endpointId: endpoint.id,
      event,
      payload,
    }).returning();

    await enqueueWebhookDelivery(delivery.id, endpoint.id, tenantId);
  }
}

export async function enqueueWebhookDelivery(deliveryId: string, endpointId: string, tenantId: string) {
  await webhookQueue.add('deliver', {
    deliveryId,
    endpointId,
    tenantId,
  }, {
    attempts: 1, // Worker handles its own retry logic internally
  });
}
