import type { Job } from 'bullmq';
import { eq, and } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { logger } from '../lib/logger.js';
import { resolveCsvAliases } from '@homer-io/shared';
import { pgTable, uuid, varchar, timestamp, jsonb, numeric, integer, text, uniqueIndex, pgEnum } from 'drizzle-orm/pg-core';

// ─── Local schema definitions (mirrors API schemas for worker context) ───────

const migrationJobs = pgTable('migration_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
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

const integrationSyncStatusEnum = pgEnum('integration_sync_status', ['pending', 'synced', 'failed', 'skipped']);

const integrationDrivers = pgTable('integration_drivers', {
  id: uuid('id').primaryKey().defaultRandom(),
  migrationJobId: uuid('migration_job_id').notNull(),
  driverId: uuid('driver_id'),
  externalDriverId: varchar('external_driver_id', { length: 255 }).notNull(),
  platform: varchar('platform', { length: 50 }).notNull(),
  rawData: jsonb('raw_data').default({}).notNull(),
  syncStatus: integrationSyncStatusEnum('sync_status').default('pending').notNull(),
  syncError: varchar('sync_error', { length: 1000 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('uq_integration_driver_dedup').on(table.migrationJobId, table.externalDriverId),
]);

const integrationVehicles = pgTable('integration_vehicles', {
  id: uuid('id').primaryKey().defaultRandom(),
  migrationJobId: uuid('migration_job_id').notNull(),
  vehicleId: uuid('vehicle_id'),
  externalVehicleId: varchar('external_vehicle_id', { length: 255 }).notNull(),
  platform: varchar('platform', { length: 50 }).notNull(),
  rawData: jsonb('raw_data').default({}).notNull(),
  syncStatus: integrationSyncStatusEnum('sync_status').default('pending').notNull(),
  syncError: varchar('sync_error', { length: 1000 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('uq_integration_vehicle_dedup').on(table.migrationJobId, table.externalVehicleId),
]);

const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  externalId: varchar('external_id', { length: 255 }),
  status: varchar('status', { length: 20 }).default('received').notNull(),
  recipientName: varchar('recipient_name', { length: 255 }).notNull(),
  recipientPhone: varchar('recipient_phone', { length: 20 }),
  recipientEmail: varchar('recipient_email', { length: 255 }),
  deliveryAddress: jsonb('delivery_address').notNull(),
  deliveryLat: numeric('delivery_lat', { precision: 10, scale: 7 }),
  deliveryLng: numeric('delivery_lng', { precision: 10, scale: 7 }),
  packageCount: integer('package_count').default(1).notNull(),
  weight: numeric('weight', { precision: 10, scale: 2 }),
  volume: numeric('volume', { precision: 10, scale: 2 }),
  serviceDurationMinutes: integer('service_duration_minutes'),
  barcodes: jsonb('barcodes').default([]).notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

const drivers = pgTable('drivers', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 20 }),
  externalId: varchar('external_id', { length: 255 }),
  status: varchar('status', { length: 20 }).default('offline').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

const vehicles = pgTable('vehicles', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 20 }).default('van').notNull(),
  licensePlate: varchar('license_plate', { length: 20 }),
  externalId: varchar('external_id', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MigrationJobData {
  migrationJobId: string;
  tenantId: string;
}

interface ProgressCounters {
  orders: { total: number; imported: number; failed: number };
  drivers: { total: number; imported: number; failed: number };
  vehicles: { total: number; imported: number; failed: number };
}

interface ErrorLogEntry {
  entity: string;
  externalId: string;
  error: string;
  timestamp: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BATCH_SIZE = 50;
const MAX_ERROR_LOG = 100;

const log = logger.child({ worker: 'migration' });

async function updateJobProgress(jobId: string, progress: ProgressCounters, errorLog: ErrorLogEntry[]) {
  await db.update(migrationJobs).set({
    progress,
    errorLog: errorLog.slice(0, MAX_ERROR_LOG),
    updatedAt: new Date(),
  }).where(eq(migrationJobs.id, jobId));
}

async function checkCancellation(jobId: string): Promise<boolean> {
  const [job] = await db.select({ status: migrationJobs.status })
    .from(migrationJobs)
    .where(eq(migrationJobs.id, jobId))
    .limit(1);
  return job?.status === 'cancelled';
}

// ─── Job Processor ────────────────────────────────────────────────────────────

export async function processMigration(job: Job<MigrationJobData>) {
  const { migrationJobId, tenantId } = job.data;

  log.info('Starting migration', { migrationJobId, tenantId });

  // Load job from DB
  const [migrationJob] = await db.select().from(migrationJobs)
    .where(and(eq(migrationJobs.id, migrationJobId), eq(migrationJobs.tenantId, tenantId)))
    .limit(1);

  if (!migrationJob) {
    log.error('Migration job not found', { migrationJobId });
    return;
  }

  if (migrationJob.status === 'cancelled') {
    log.info('Migration job already cancelled', { migrationJobId });
    return;
  }

  // Set status to in_progress
  await db.update(migrationJobs).set({
    status: 'in_progress',
    startedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(migrationJobs.id, migrationJobId));

  const config = migrationJob.config as Record<string, unknown>;
  const csvData = config.csvData as {
    orders?: Record<string, string>[];
    drivers?: Record<string, string>[];
    vehicles?: Record<string, string>[];
  } | undefined;

  const progress: ProgressCounters = {
    orders: { total: csvData?.orders?.length ?? 0, imported: 0, failed: 0 },
    drivers: { total: csvData?.drivers?.length ?? 0, imported: 0, failed: 0 },
    vehicles: { total: csvData?.vehicles?.length ?? 0, imported: 0, failed: 0 },
  };
  const errorLog: ErrorLogEntry[] = [];
  const platform = migrationJob.sourcePlatform;

  try {
    // ─── Process Orders ─────────────────────────────────────────────────
    if (config.importOrders !== false && csvData?.orders?.length) {
      const orderRows = csvData.orders;
      for (let i = 0; i < orderRows.length; i += BATCH_SIZE) {
        if (await checkCancellation(migrationJobId)) {
          await db.update(migrationJobs).set({ status: 'cancelled', updatedAt: new Date() })
            .where(eq(migrationJobs.id, migrationJobId));
          log.info('Migration cancelled during order processing', { migrationJobId });
          return;
        }

        const batch = orderRows.slice(i, i + BATCH_SIZE);
        for (const row of batch) {
          try {
            const aliases = resolveCsvAliases(row);
            const coords = aliases.latitude && aliases.longitude
              ? { lat: aliases.latitude, lng: aliases.longitude }
              : undefined;

            await db.insert(orders).values({
              tenantId,
              externalId: aliases.externalId || row.external_id || row.order_id,
              recipientName: row.recipient_name || row.name || row.customer_name || 'Unknown',
              recipientPhone: row.phone || row.recipient_phone || row.customer_phone,
              recipientEmail: row.email || row.recipient_email || row.customer_email,
              deliveryAddress: {
                street: row.street || row.address || '',
                city: row.city || '',
                state: row.state || '',
                zip: row.zip || row.postal_code || '',
                country: row.country || 'US',
                ...(coords ? { coords } : {}),
              },
              deliveryLat: aliases.latitude?.toString() ?? null,
              deliveryLng: aliases.longitude?.toString() ?? null,
              packageCount: row.packages ? parseInt(row.packages) || 1 : 1,
              weight: aliases.weight?.toString() ?? null,
              volume: aliases.volume?.toString() ?? null,
              serviceDurationMinutes: aliases.serviceDurationMinutes,
              barcodes: aliases.barcodes,
              notes: row.notes || `Migrated from ${platform}`,
            });
            progress.orders.imported++;
          } catch (err) {
            progress.orders.failed++;
            if (errorLog.length < MAX_ERROR_LOG) {
              errorLog.push({
                entity: 'order',
                externalId: row.external_id || row.order_id || `row-${progress.orders.imported + progress.orders.failed}`,
                error: err instanceof Error ? err.message.slice(0, 500) : 'Unknown error',
                timestamp: new Date().toISOString(),
              });
            }
          }
        }
        await updateJobProgress(migrationJobId, progress, errorLog);
      }
    }

    // ─── Process Drivers ────────────────────────────────────────────────
    if (config.importDrivers !== false && csvData?.drivers?.length) {
      const driverRows = csvData.drivers;
      for (let i = 0; i < driverRows.length; i += BATCH_SIZE) {
        if (await checkCancellation(migrationJobId)) {
          await db.update(migrationJobs).set({ status: 'cancelled', updatedAt: new Date() })
            .where(eq(migrationJobs.id, migrationJobId));
          return;
        }

        const batch = driverRows.slice(i, i + BATCH_SIZE);
        for (const row of batch) {
          try {
            const extId = row.external_id || row.driver_id || row.id || '';
            const [newDriver] = await db.insert(drivers).values({
              tenantId,
              name: row.name || row.driver_name || 'Unknown Driver',
              email: row.email || row.driver_email || undefined,
              phone: row.phone || row.driver_phone || undefined,
              externalId: extId || undefined,
            }).returning();

            await db.insert(integrationDrivers).values({
              migrationJobId,
              driverId: newDriver.id,
              externalDriverId: extId || newDriver.id,
              platform,
              rawData: row,
              syncStatus: 'synced',
            }).onConflictDoNothing();

            progress.drivers.imported++;
          } catch (err) {
            progress.drivers.failed++;
            if (errorLog.length < MAX_ERROR_LOG) {
              errorLog.push({
                entity: 'driver',
                externalId: row.external_id || row.driver_id || `row-${progress.drivers.imported + progress.drivers.failed}`,
                error: err instanceof Error ? err.message.slice(0, 500) : 'Unknown error',
                timestamp: new Date().toISOString(),
              });
            }
          }
        }
        await updateJobProgress(migrationJobId, progress, errorLog);
      }
    }

    // ─── Process Vehicles ───────────────────────────────────────────────
    if (config.importVehicles !== false && csvData?.vehicles?.length) {
      const vehicleRows = csvData.vehicles;
      for (let i = 0; i < vehicleRows.length; i += BATCH_SIZE) {
        if (await checkCancellation(migrationJobId)) {
          await db.update(migrationJobs).set({ status: 'cancelled', updatedAt: new Date() })
            .where(eq(migrationJobs.id, migrationJobId));
          return;
        }

        const batch = vehicleRows.slice(i, i + BATCH_SIZE);
        for (const row of batch) {
          try {
            const extId = row.external_id || row.vehicle_id || row.id || '';
            const vehicleType = row.type || row.vehicle_type || 'van';
            const [newVehicle] = await db.insert(vehicles).values({
              tenantId,
              name: row.name || row.vehicle_name || 'Unknown Vehicle',
              type: vehicleType,
              licensePlate: row.license_plate || row.plate || undefined,
              externalId: extId || undefined,
            }).returning();

            await db.insert(integrationVehicles).values({
              migrationJobId,
              vehicleId: newVehicle.id,
              externalVehicleId: extId || newVehicle.id,
              platform,
              rawData: row,
              syncStatus: 'synced',
            }).onConflictDoNothing();

            progress.vehicles.imported++;
          } catch (err) {
            progress.vehicles.failed++;
            if (errorLog.length < MAX_ERROR_LOG) {
              errorLog.push({
                entity: 'vehicle',
                externalId: row.external_id || row.vehicle_id || `row-${progress.vehicles.imported + progress.vehicles.failed}`,
                error: err instanceof Error ? err.message.slice(0, 500) : 'Unknown error',
                timestamp: new Date().toISOString(),
              });
            }
          }
        }
        await updateJobProgress(migrationJobId, progress, errorLog);
      }
    }

    // ─── Complete ───────────────────────────────────────────────────────
    await db.update(migrationJobs).set({
      status: 'completed',
      completedAt: new Date(),
      progress,
      errorLog: errorLog.slice(0, MAX_ERROR_LOG),
      updatedAt: new Date(),
    }).where(eq(migrationJobs.id, migrationJobId));

    log.info('Migration completed', {
      migrationJobId,
      orders: progress.orders,
      drivers: progress.drivers,
      vehicles: progress.vehicles,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown migration error';
    log.error('Migration failed', { migrationJobId, error: errorMsg });

    await db.update(migrationJobs).set({
      status: 'failed',
      progress,
      errorLog: errorLog.slice(0, MAX_ERROR_LOG),
      updatedAt: new Date(),
    }).where(eq(migrationJobs.id, migrationJobId));

    throw err; // Let BullMQ handle retries
  }
}
