import { pgTable, uuid, varchar, timestamp, text, jsonb } from 'drizzle-orm/pg-core';

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).unique().notNull(),
  timezone: varchar('timezone', { length: 100 }).default('America/Los_Angeles').notNull(),
  currency: varchar('currency', { length: 3 }).default('USD').notNull(),
  units: varchar('units', { length: 10 }).default('imperial').notNull(),
  settings: jsonb('settings').default({}).notNull(),
  logoUrl: text('logo_url'),
  primaryColor: varchar('primary_color', { length: 7 }).default('#5BA4F5'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
