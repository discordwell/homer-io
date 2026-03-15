import { z } from 'zod';

export const webhookEvents = [
  'order.created', 'order.updated', 'order.assigned', 'order.delivered', 'order.failed',
  'route.created', 'route.planned', 'route.started', 'route.completed', 'route.cancelled',
  'delivery.completed', 'delivery.failed',
  'driver.location_updated', 'driver.status_changed',
] as const;
export type WebhookEvent = (typeof webhookEvents)[number];

export const createWebhookEndpointSchema = z.object({
  url: z.string().url().startsWith('https', { message: 'Webhook URL must use HTTPS' }),
  events: z.array(z.string()).min(1),
  description: z.string().max(255).optional(),
});
export type CreateWebhookEndpointInput = z.infer<typeof createWebhookEndpointSchema>;

export const updateWebhookEndpointSchema = z.object({
  url: z.string().url().startsWith('https').optional(),
  events: z.array(z.string()).min(1).optional(),
  description: z.string().max(255).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateWebhookEndpointInput = z.infer<typeof updateWebhookEndpointSchema>;

export const webhookEndpointResponseSchema = z.object({
  id: z.string().uuid(),
  url: z.string(),
  events: z.array(z.string()),
  secret: z.string(),
  isActive: z.boolean(),
  description: z.string().nullable(),
  failureCount: z.number(),
  lastSuccessAt: z.string().nullable(),
  lastFailureAt: z.string().nullable(),
  createdAt: z.string(),
});
export type WebhookEndpointResponse = z.infer<typeof webhookEndpointResponseSchema>;

export const webhookDeliveryResponseSchema = z.object({
  id: z.string().uuid(),
  endpointId: z.string().uuid(),
  event: z.string(),
  payload: z.record(z.unknown()),
  status: z.enum(['pending', 'success', 'failed']),
  httpStatus: z.number().nullable(),
  responseBody: z.string().nullable(),
  attempts: z.number(),
  nextRetryAt: z.string().nullable(),
  createdAt: z.string(),
});
export type WebhookDeliveryResponse = z.infer<typeof webhookDeliveryResponseSchema>;
