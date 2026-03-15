import { pgTable, uuid, varchar, timestamp, text, jsonb, integer, pgEnum, index } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
import { webhookEndpoints } from './webhook-endpoints.js';

export const webhookDeliveryStatusEnum = pgEnum('webhook_delivery_status', [
  'pending', 'success', 'failed',
]);

export const webhookDeliveries = pgTable('webhook_deliveries', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  endpointId: uuid('endpoint_id').references(() => webhookEndpoints.id, { onDelete: 'cascade' }).notNull(),
  event: varchar('event', { length: 100 }).notNull(),
  payload: jsonb('payload').default({}).notNull(),
  status: webhookDeliveryStatusEnum('status').default('pending').notNull(),
  httpStatus: integer('http_status'),
  responseBody: text('response_body'),
  attempts: integer('attempts').default(0).notNull(),
  nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_webhook_deliveries_endpoint_created').on(table.endpointId, table.createdAt),
]);
