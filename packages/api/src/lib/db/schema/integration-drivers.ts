import { pgTable, uuid, varchar, timestamp, jsonb, uniqueIndex } from 'drizzle-orm/pg-core';
import { migrationJobs } from './migration-jobs.js';
import { drivers } from './drivers.js';
import { integrationSyncStatusEnum } from './integration-orders.js';

export const integrationDrivers = pgTable('integration_drivers', {
  id: uuid('id').primaryKey().defaultRandom(),
  migrationJobId: uuid('migration_job_id').references(() => migrationJobs.id, { onDelete: 'cascade' }).notNull(),
  driverId: uuid('driver_id').references(() => drivers.id, { onDelete: 'set null' }),
  externalDriverId: varchar('external_driver_id', { length: 255 }).notNull(),
  platform: varchar('platform', { length: 50 }).notNull(),
  rawData: jsonb('raw_data').default({}).notNull(),
  syncStatus: integrationSyncStatusEnum('sync_status').default('pending').notNull(),
  syncError: varchar('sync_error', { length: 1000 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('uq_integration_driver_dedup').on(table.migrationJobId, table.externalDriverId),
]);
