import { pgTable, uuid, varchar, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';

export const migrationJobs = pgTable('migration_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  sourcePlatform: varchar('source_platform', { length: 50 }).notNull(),
  status: varchar('status', { length: 20 }).default('pending').notNull(),
  config: jsonb('config').default({}).notNull(),
  progress: jsonb('progress').default({}).notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  errorLog: jsonb('error_log').default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
