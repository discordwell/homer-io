import { pgTable, uuid, varchar, timestamp, index } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';

export const driverInvites = pgTable('driver_invites', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  token: varchar('token', { length: 64 }).unique().notNull(),
  createdBy: uuid('created_by'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  redeemedAt: timestamp('redeemed_at', { withTimezone: true }),
  redeemedByUserId: uuid('redeemed_by_user_id'),
  redeemedByDriverId: uuid('redeemed_by_driver_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_driver_invites_token').on(table.token),
  index('idx_driver_invites_tenant').on(table.tenantId),
]);
