import { z } from 'zod';

export const migrationPlatformEnum = z.enum([
  'tookan', 'onfleet', 'optimoroute', 'speedyroute', 'getswift', 'circuit',
]);
export type MigrationPlatform = z.infer<typeof migrationPlatformEnum>;

export const migrationJobStatusEnum = z.enum([
  'pending', 'in_progress', 'completed', 'failed', 'cancelled',
]);
export type MigrationJobStatus = z.infer<typeof migrationJobStatusEnum>;

export const migrationConfigSchema = z.object({
  apiKey: z.string().min(1).optional(),
  dateRangeStart: z.string().datetime().optional(),
  dateRangeEnd: z.string().datetime().optional(),
  importOrders: z.boolean().default(true),
  importDrivers: z.boolean().default(true),
  importVehicles: z.boolean().default(false),
});
export type MigrationConfig = z.infer<typeof migrationConfigSchema>;

export const migrationCsvDataSchema = z.object({
  orders: z.array(z.record(z.string())).max(5000).optional(),
  drivers: z.array(z.record(z.string())).max(500).optional(),
  vehicles: z.array(z.record(z.string())).max(200).optional(),
}).optional();

export const createMigrationJobSchema = z.object({
  sourcePlatform: migrationPlatformEnum,
  config: migrationConfigSchema,
  csvData: migrationCsvDataSchema,
});
export type CreateMigrationJobInput = z.infer<typeof createMigrationJobSchema>;

export const migrationProgressSchema = z.object({
  orders: z.object({
    total: z.number().int().default(0),
    imported: z.number().int().default(0),
    failed: z.number().int().default(0),
  }).default({ total: 0, imported: 0, failed: 0 }),
  drivers: z.object({
    total: z.number().int().default(0),
    imported: z.number().int().default(0),
    failed: z.number().int().default(0),
  }).default({ total: 0, imported: 0, failed: 0 }),
  vehicles: z.object({
    total: z.number().int().default(0),
    imported: z.number().int().default(0),
    failed: z.number().int().default(0),
  }).default({ total: 0, imported: 0, failed: 0 }),
});
export type MigrationProgress = z.infer<typeof migrationProgressSchema>;

export const migrationErrorLogEntrySchema = z.object({
  entity: z.string(),
  externalId: z.string(),
  error: z.string(),
  timestamp: z.string().datetime(),
});
export type MigrationErrorLogEntry = z.infer<typeof migrationErrorLogEntrySchema>;

export const migrationJobResponseSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  sourcePlatform: migrationPlatformEnum,
  status: migrationJobStatusEnum,
  config: migrationConfigSchema,
  progress: migrationProgressSchema,
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  errorLog: z.array(migrationErrorLogEntrySchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type MigrationJobResponse = z.infer<typeof migrationJobResponseSchema>;
