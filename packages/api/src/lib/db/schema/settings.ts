import { pgTable, uuid, varchar, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';

export const orgSettings = pgTable('org_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull().unique(),
  timezone: varchar('timezone', { length: 100 }).default('America/Los_Angeles').notNull(),
  units: varchar('units', { length: 10 }).default('imperial').notNull(),
  branding: jsonb('branding').default({}).notNull(),
  notificationPrefs: jsonb('notification_prefs').default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
