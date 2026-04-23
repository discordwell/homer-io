import { pgTable, uuid, varchar, timestamp, jsonb, pgEnum, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';

export const telematicsProviderEnum = pgEnum('telematics_provider', [
  'samsara', 'motive', 'geotab',
]);

export const telematicsConnectionStatusEnum = pgEnum('telematics_connection_status', [
  'active', 'pending_reauth', 'error', 'disabled',
]);

export const telematicsConnections = pgTable('telematics_connections', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  provider: telematicsProviderEnum('provider').notNull(),
  authMaterial: jsonb('auth_material').notNull(), // AES-256-GCM encrypted
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
  externalOrgId: varchar('external_org_id', { length: 255 }),
  accountName: varchar('account_name', { length: 255 }),
  status: telematicsConnectionStatusEnum('status').default('active').notNull(),
  disabledReason: varchar('disabled_reason', { length: 500 }),
  lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
  webhookId: varchar('webhook_id', { length: 255 }),
  webhookSecret: varchar('webhook_secret', { length: 128 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('uq_telematics_connection_tenant_provider').on(table.tenantId, table.provider),
  index('idx_telematics_connections_status').on(table.status),
]);
