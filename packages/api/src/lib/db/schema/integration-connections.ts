import { pgTable, uuid, varchar, timestamp, boolean, integer, jsonb, pgEnum, uniqueIndex } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';

export const integrationPlatformEnum = pgEnum('integration_platform', [
  'shopify', 'woocommerce',
  'tookan', 'onfleet', 'optimoroute', 'speedyroute', 'getswift', 'circuit',
]);

export const syncStatusEnum = pgEnum('sync_status', [
  'idle', 'syncing', 'error',
]);

export const integrationConnections = pgTable('integration_connections', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  platform: integrationPlatformEnum('platform').notNull(),
  storeUrl: varchar('store_url', { length: 500 }).notNull(),
  credentials: jsonb('credentials').notNull(), // AES-256-GCM encrypted
  webhookIds: jsonb('webhook_ids').default([]).notNull(),
  webhookSecret: varchar('webhook_secret', { length: 64 }), // per-connection secret for inbound webhook verification
  autoImport: boolean('auto_import').default(true).notNull(),
  syncStatus: syncStatusEnum('sync_status').default('idle').notNull(),
  lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
  lastSyncError: varchar('last_sync_error', { length: 1000 }),
  orderCount: integer('order_count').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('uq_connection_tenant_platform_store').on(table.tenantId, table.platform, table.storeUrl),
]);
