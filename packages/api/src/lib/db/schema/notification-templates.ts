import { pgTable, uuid, varchar, timestamp, text, boolean, pgEnum, index } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';

export const notificationTriggerEnum = pgEnum('notification_trigger', [
  'order_assigned', 'driver_en_route', 'delivery_approaching', 'delivered', 'failed',
]);

export const notificationChannelEnum = pgEnum('notification_channel', [
  'sms', 'email',
]);

export const notificationTemplates = pgTable('notification_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  trigger: notificationTriggerEnum('trigger').notNull(),
  channel: notificationChannelEnum('channel').notNull(),
  subject: text('subject'),
  bodyTemplate: text('body_template').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  recipientType: varchar('recipient_type', { length: 20 }).default('recipient').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_notification_templates_tenant_trigger').on(table.tenantId, table.trigger),
]);
