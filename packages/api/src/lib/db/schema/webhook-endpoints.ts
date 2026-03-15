import { pgTable, uuid, varchar, timestamp, text, boolean, jsonb, integer, index } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';

export const webhookEndpoints = pgTable('webhook_endpoints', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  url: text('url').notNull(),
  events: jsonb('events').default([]).notNull(),
  secret: varchar('secret', { length: 255 }).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  description: varchar('description', { length: 255 }),
  failureCount: integer('failure_count').default(0).notNull(),
  lastSuccessAt: timestamp('last_success_at', { withTimezone: true }),
  lastFailureAt: timestamp('last_failure_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_webhook_endpoints_tenant').on(table.tenantId),
]);
