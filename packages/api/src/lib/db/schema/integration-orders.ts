import { pgTable, uuid, varchar, timestamp, jsonb, pgEnum, uniqueIndex } from 'drizzle-orm/pg-core';
import { integrationConnections } from './integration-connections.js';
import { orders } from './orders.js';

export const integrationSyncStatusEnum = pgEnum('integration_sync_status', [
  'pending', 'synced', 'failed', 'skipped',
]);

export const integrationOrders = pgTable('integration_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  connectionId: uuid('connection_id').references(() => integrationConnections.id, { onDelete: 'cascade' }).notNull(),
  orderId: uuid('order_id').references(() => orders.id, { onDelete: 'set null' }),
  externalOrderId: varchar('external_order_id', { length: 255 }).notNull(),
  platform: varchar('platform', { length: 50 }).notNull(),
  rawData: jsonb('raw_data').default({}).notNull(),
  syncStatus: integrationSyncStatusEnum('sync_status').default('pending').notNull(),
  syncError: varchar('sync_error', { length: 1000 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('uq_integration_order_dedup').on(table.connectionId, table.externalOrderId),
]);
