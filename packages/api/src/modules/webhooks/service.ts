import { eq, and, desc } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import type { CreateWebhookEndpointInput, UpdateWebhookEndpointInput } from '@homer-io/shared';
import { db } from '../../lib/db/index.js';
import { webhookEndpoints } from '../../lib/db/schema/webhook-endpoints.js';
import { webhookDeliveries } from '../../lib/db/schema/webhook-deliveries.js';
import { HttpError } from '../../lib/errors.js';
import { logActivity } from '../../lib/activity.js';
import { enqueueWebhook } from '../../lib/webhooks.js';

function formatEndpoint(ep: typeof webhookEndpoints.$inferSelect) {
  return {
    id: ep.id,
    url: ep.url,
    events: ep.events as string[],
    secret: ep.secret,
    isActive: ep.isActive,
    description: ep.description,
    failureCount: ep.failureCount,
    lastSuccessAt: ep.lastSuccessAt?.toISOString() ?? null,
    lastFailureAt: ep.lastFailureAt?.toISOString() ?? null,
    createdAt: ep.createdAt.toISOString(),
  };
}

function formatDelivery(d: typeof webhookDeliveries.$inferSelect) {
  return {
    id: d.id,
    endpointId: d.endpointId,
    event: d.event,
    payload: d.payload as Record<string, unknown>,
    status: d.status,
    httpStatus: d.httpStatus,
    responseBody: d.responseBody,
    attempts: d.attempts,
    nextRetryAt: d.nextRetryAt?.toISOString() ?? null,
    createdAt: d.createdAt.toISOString(),
  };
}

export async function createEndpoint(
  tenantId: string,
  userId: string,
  input: CreateWebhookEndpointInput,
) {
  const secret = randomBytes(32).toString('hex');

  const [created] = await db
    .insert(webhookEndpoints)
    .values({
      tenantId,
      url: input.url,
      events: input.events,
      secret,
      description: input.description ?? null,
    })
    .returning();

  await logActivity({
    tenantId,
    userId,
    action: 'create',
    entityType: 'webhook_endpoint',
    entityId: created.id,
    metadata: { url: input.url, events: input.events },
  });

  return formatEndpoint(created);
}

export async function listEndpoints(tenantId: string) {
  const endpoints = await db
    .select()
    .from(webhookEndpoints)
    .where(eq(webhookEndpoints.tenantId, tenantId))
    .orderBy(desc(webhookEndpoints.createdAt));

  return endpoints.map(formatEndpoint);
}

export async function updateEndpoint(
  tenantId: string,
  endpointId: string,
  userId: string,
  input: UpdateWebhookEndpointInput,
) {
  const [existing] = await db
    .select({ id: webhookEndpoints.id })
    .from(webhookEndpoints)
    .where(and(eq(webhookEndpoints.id, endpointId), eq(webhookEndpoints.tenantId, tenantId)))
    .limit(1);

  if (!existing) {
    throw new HttpError(404, 'Webhook endpoint not found');
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (input.url !== undefined) updateData.url = input.url;
  if (input.events !== undefined) updateData.events = input.events;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.isActive !== undefined) updateData.isActive = input.isActive;

  const [updated] = await db
    .update(webhookEndpoints)
    .set(updateData)
    .where(and(eq(webhookEndpoints.id, endpointId), eq(webhookEndpoints.tenantId, tenantId)))
    .returning();

  await logActivity({
    tenantId,
    userId,
    action: 'update',
    entityType: 'webhook_endpoint',
    entityId: endpointId,
    metadata: { changes: Object.keys(input) },
  });

  return formatEndpoint(updated);
}

export async function deleteEndpoint(
  tenantId: string,
  endpointId: string,
  userId: string,
) {
  const [existing] = await db
    .select({ id: webhookEndpoints.id, url: webhookEndpoints.url })
    .from(webhookEndpoints)
    .where(and(eq(webhookEndpoints.id, endpointId), eq(webhookEndpoints.tenantId, tenantId)))
    .limit(1);

  if (!existing) {
    throw new HttpError(404, 'Webhook endpoint not found');
  }

  await db
    .delete(webhookEndpoints)
    .where(and(eq(webhookEndpoints.id, endpointId), eq(webhookEndpoints.tenantId, tenantId)));

  await logActivity({
    tenantId,
    userId,
    action: 'delete',
    entityType: 'webhook_endpoint',
    entityId: endpointId,
    metadata: { url: existing.url },
  });
}

export async function testEndpoint(
  tenantId: string,
  endpointId: string,
  userId: string,
) {
  const [endpoint] = await db
    .select()
    .from(webhookEndpoints)
    .where(and(eq(webhookEndpoints.id, endpointId), eq(webhookEndpoints.tenantId, tenantId)))
    .limit(1);

  if (!endpoint) {
    throw new HttpError(404, 'Webhook endpoint not found');
  }

  const testPayload = {
    type: 'webhook.test',
    timestamp: new Date().toISOString(),
    data: {
      message: 'This is a test webhook delivery from HOMER.io',
      endpointId: endpoint.id,
    },
  };

  // Create a delivery record directly for the test event
  const [delivery] = await db
    .insert(webhookDeliveries)
    .values({
      tenantId,
      endpointId: endpoint.id,
      event: 'webhook.test',
      payload: testPayload,
    })
    .returning();

  // Enqueue the test delivery using the shared queue
  const { Queue } = await import('bullmq');
  const { config } = await import('../../config.js');
  const webhookQueue = new Queue('webhook-delivery', { connection: { url: config.redis.url } });

  await webhookQueue.add('deliver', {
    deliveryId: delivery.id,
    endpointId: endpoint.id,
    tenantId,
  }, {
    attempts: 5,
    backoff: { type: 'custom' },
  });

  await webhookQueue.close();

  await logActivity({
    tenantId,
    userId,
    action: 'test',
    entityType: 'webhook_endpoint',
    entityId: endpointId,
    metadata: { url: endpoint.url },
  });

  return { success: true, deliveryId: delivery.id };
}

export async function listDeliveries(
  tenantId: string,
  endpointId: string,
  page: number = 1,
  limit: number = 20,
) {
  // Verify endpoint belongs to tenant
  const [endpoint] = await db
    .select({ id: webhookEndpoints.id })
    .from(webhookEndpoints)
    .where(and(eq(webhookEndpoints.id, endpointId), eq(webhookEndpoints.tenantId, tenantId)))
    .limit(1);

  if (!endpoint) {
    throw new HttpError(404, 'Webhook endpoint not found');
  }

  const offset = (page - 1) * limit;

  const deliveries = await db
    .select()
    .from(webhookDeliveries)
    .where(and(
      eq(webhookDeliveries.endpointId, endpointId),
      eq(webhookDeliveries.tenantId, tenantId),
    ))
    .orderBy(desc(webhookDeliveries.createdAt))
    .limit(limit)
    .offset(offset);

  // Get total count for pagination
  const allDeliveries = await db
    .select({ id: webhookDeliveries.id })
    .from(webhookDeliveries)
    .where(and(
      eq(webhookDeliveries.endpointId, endpointId),
      eq(webhookDeliveries.tenantId, tenantId),
    ));

  const total = allDeliveries.length;
  const totalPages = Math.ceil(total / limit);

  return {
    data: deliveries.map(formatDelivery),
    page,
    totalPages,
    total,
  };
}
