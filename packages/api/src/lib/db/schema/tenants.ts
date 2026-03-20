import { pgTable, uuid, varchar, timestamp, text, jsonb, integer, boolean, index } from 'drizzle-orm/pg-core';

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
  onboardingCompletedAt: timestamp('onboarding_completed_at', { withTimezone: true }),
  onboardingStep: integer('onboarding_step').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  orgDomain: varchar('org_domain', { length: 255 }),
  autoJoinEnabled: boolean('auto_join_enabled').default(true).notNull(),
  isDemo: boolean('is_demo').default(false).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_tenants_org_domain').on(table.orgDomain),
]);
