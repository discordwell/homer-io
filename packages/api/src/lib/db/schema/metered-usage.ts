import { pgTable, uuid, varchar, timestamp, integer, uniqueIndex } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';

export const meteredUsage = pgTable('metered_usage', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  period: varchar('period', { length: 7 }).notNull(), // YYYY-MM
  aiOptimizations: integer('ai_optimizations').default(0).notNull(),
  aiDispatches: integer('ai_dispatches').default(0).notNull(),
  aiChatMessages: integer('ai_chat_messages').default(0).notNull(),
  smsSent: integer('sms_sent').default(0).notNull(),
  emailsSent: integer('emails_sent').default(0).notNull(),
  podStorageMb: integer('pod_storage_mb').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('metered_usage_tenant_period_idx').on(table.tenantId, table.period),
]);
