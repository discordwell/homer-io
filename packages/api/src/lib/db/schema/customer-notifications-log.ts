import { pgTable, uuid, varchar, timestamp, text, pgEnum } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
import { orders } from './orders.js';

export const customerNotificationStatusEnum = pgEnum('customer_notification_status', [
  'queued', 'sent', 'delivered', 'failed',
]);

export const customerNotificationsLog = pgTable('customer_notifications_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  orderId: uuid('order_id').references(() => orders.id, { onDelete: 'cascade' }).notNull(),
  channel: varchar('channel', { length: 10 }).notNull(),
  trigger: varchar('trigger', { length: 50 }).notNull(),
  recipient: varchar('recipient', { length: 255 }).notNull(),
  subject: text('subject'),
  body: text('body').notNull(),
  status: customerNotificationStatusEnum('status').default('queued').notNull(),
  providerId: varchar('provider_id', { length: 255 }),
  errorMessage: text('error_message'),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
