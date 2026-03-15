import { pgTable, uuid, varchar, timestamp, integer } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';

export const usageRecords = pgTable('usage_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  period: varchar('period', { length: 7 }).notNull(), // YYYY-MM
  driverCount: integer('driver_count').default(0).notNull(),
  orderCount: integer('order_count').default(0).notNull(),
  routeCount: integer('route_count').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
