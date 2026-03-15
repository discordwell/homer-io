import { pgTable, uuid, varchar, timestamp, jsonb, pgEnum, text, index } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
import { users } from './users.js';

export const notificationTypeEnum = pgEnum('notification_type', [
  'delivery_completed', 'delivery_failed', 'route_started', 'route_completed',
  'driver_offline', 'system', 'team_invite', 'order_received',
]);

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  type: notificationTypeEnum('type').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  body: text('body').notNull(),
  data: jsonb('data').default({}).notNull(),
  readAt: timestamp('read_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_notifications_user_read').on(table.userId, table.readAt),
  index('idx_notifications_tenant_created').on(table.tenantId, table.createdAt),
]);
