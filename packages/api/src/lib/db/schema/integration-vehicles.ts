import { pgTable, uuid, varchar, timestamp, jsonb, uniqueIndex } from 'drizzle-orm/pg-core';
import { migrationJobs } from './migration-jobs.js';
import { vehicles } from './vehicles.js';
import { integrationSyncStatusEnum } from './integration-orders.js';

export const integrationVehicles = pgTable('integration_vehicles', {
  id: uuid('id').primaryKey().defaultRandom(),
  migrationJobId: uuid('migration_job_id').references(() => migrationJobs.id, { onDelete: 'cascade' }).notNull(),
  vehicleId: uuid('vehicle_id').references(() => vehicles.id, { onDelete: 'set null' }),
  externalVehicleId: varchar('external_vehicle_id', { length: 255 }).notNull(),
  platform: varchar('platform', { length: 50 }).notNull(),
  rawData: jsonb('raw_data').default({}).notNull(),
  syncStatus: integrationSyncStatusEnum('sync_status').default('pending').notNull(),
  syncError: varchar('sync_error', { length: 1000 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('uq_integration_vehicle_dedup').on(table.migrationJobId, table.externalVehicleId),
]);
