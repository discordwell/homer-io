import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createMigrationJobSchema,
  migrationJobResponseSchema,
  migrationPlatformEnum,
  migrationCsvDataSchema,
} from '@homer-io/shared';

// ─── Mock DB ──────────────────────────────────────────────────────────────────

const mockReturning = vi.fn().mockResolvedValue([{
  id: 'mig-1',
  tenantId: 'tenant-1',
  sourcePlatform: 'tookan',
  status: 'pending',
  config: { importOrders: true, importDrivers: true, importVehicles: false },
  progress: { orders: { total: 3, imported: 0, failed: 0 }, drivers: { total: 0, imported: 0, failed: 0 }, vehicles: { total: 0, imported: 0, failed: 0 } },
  startedAt: null,
  completedAt: null,
  errorLog: [],
  createdAt: new Date('2026-03-16T00:00:00Z'),
  updatedAt: new Date('2026-03-16T00:00:00Z'),
}]);
const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
const mockInsert = vi.fn().mockReturnValue({ values: mockValues });

const mockSelectLimit = vi.fn().mockResolvedValue([{
  id: 'mig-1',
  tenantId: 'tenant-1',
  sourcePlatform: 'tookan',
  status: 'pending',
  config: { importOrders: true, apiKey: 'enc:secret' },
  progress: { orders: { total: 0, imported: 0, failed: 0 }, drivers: { total: 0, imported: 0, failed: 0 }, vehicles: { total: 0, imported: 0, failed: 0 } },
  startedAt: null,
  completedAt: null,
  errorLog: [],
  createdAt: new Date('2026-03-16T00:00:00Z'),
  updatedAt: new Date('2026-03-16T00:00:00Z'),
}]);
const mockSelectWhere = vi.fn().mockReturnValue({ limit: mockSelectLimit, offset: vi.fn().mockResolvedValue([]) });
const mockSelectFrom = vi.fn().mockReturnValue({ where: mockSelectWhere, orderBy: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue({ offset: vi.fn().mockResolvedValue([]) }) }) });

const mockUpdateReturning = vi.fn().mockResolvedValue([{ id: 'mig-1', tenantId: 'tenant-1', sourcePlatform: 'tookan', status: 'cancelled', config: {}, progress: {}, startedAt: null, completedAt: null, errorLog: [], createdAt: new Date(), updatedAt: new Date() }]);
const mockUpdateWhere = vi.fn().mockReturnValue({ returning: mockUpdateReturning });
const mockUpdateSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
const mockDeleteWhere = vi.fn().mockResolvedValue(undefined);

const mockDb = {
  insert: mockInsert,
  delete: vi.fn().mockReturnValue({ where: mockDeleteWhere }),
  select: vi.fn().mockReturnValue({ from: mockSelectFrom }),
  update: vi.fn().mockReturnValue({ set: mockUpdateSet }),
};

vi.mock('../lib/db/index.js', () => ({ db: mockDb }));

vi.mock('../lib/db/schema/migration-jobs.js', () => ({
  migrationJobs: {
    id: 'id', tenantId: 'tenant_id', sourcePlatform: 'source_platform',
    status: 'status', config: 'config', progress: 'progress',
    startedAt: 'started_at', completedAt: 'completed_at', errorLog: 'error_log',
    createdAt: 'created_at', updatedAt: 'updated_at',
  },
}));

vi.mock('../lib/db/schema/activity-log.js', () => ({
  activityLog: { id: 'id', tenantId: 'tenant_id' },
}));

const mockLogActivity = vi.fn().mockResolvedValue(undefined);
vi.mock('../lib/activity.js', () => ({
  logActivity: (...args: any[]) => mockLogActivity(...args),
}));

vi.mock('../lib/integrations/crypto.js', () => ({
  encrypt: (v: string) => `enc:${v}`,
}));

vi.mock('../../config.js', () => ({
  config: { redis: { url: 'redis://localhost:6379' } },
}));

// Mock BullMQ Queue
const mockQueueAdd = vi.fn().mockResolvedValue({ id: 'bull-job-1' });
vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: mockQueueAdd,
  })),
}));

vi.mock('../lib/errors.js', () => ({
  HttpError: class HttpError extends Error {
    statusCode: number;
    constructor(statusCode: number, message: string) {
      super(message);
      this.statusCode = statusCode;
    }
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Schema Validation Tests ──────────────────────────────────────────────────

describe('Migration schema validation', () => {
  it('creates job with csvData', () => {
    const input = {
      sourcePlatform: 'tookan',
      config: { importOrders: true, importDrivers: false, importVehicles: false },
      csvData: {
        orders: [
          { name: 'John Doe', address: '123 Main St', city: 'Portland', state: 'OR', zip: '97201' },
        ],
      },
    };
    const result = createMigrationJobSchema.parse(input);
    expect(result.sourcePlatform).toBe('tookan');
    expect(result.csvData?.orders).toHaveLength(1);
  });

  it('rejects oversized csvData (>5000 orders)', () => {
    const rows = Array.from({ length: 5001 }, (_, i) => ({ name: `Order ${i}` }));
    expect(() =>
      createMigrationJobSchema.parse({
        sourcePlatform: 'onfleet',
        config: { importOrders: true },
        csvData: { orders: rows },
      }),
    ).toThrow();
  });

  it('rejects oversized csvData (>500 drivers)', () => {
    const rows = Array.from({ length: 501 }, (_, i) => ({ name: `Driver ${i}` }));
    expect(() =>
      createMigrationJobSchema.parse({
        sourcePlatform: 'onfleet',
        config: { importDrivers: true },
        csvData: { drivers: rows },
      }),
    ).toThrow();
  });

  it('rejects oversized csvData (>200 vehicles)', () => {
    const rows = Array.from({ length: 201 }, (_, i) => ({ name: `Vehicle ${i}` }));
    expect(() =>
      createMigrationJobSchema.parse({
        sourcePlatform: 'onfleet',
        config: { importVehicles: true },
        csvData: { vehicles: rows },
      }),
    ).toThrow();
  });

  it('validates without csvData (API-key path for 7C)', () => {
    const result = createMigrationJobSchema.parse({
      sourcePlatform: 'circuit',
      config: { apiKey: 'my-api-key', importOrders: true },
    });
    expect(result.sourcePlatform).toBe('circuit');
    expect(result.csvData).toBeUndefined();
    expect(result.config.apiKey).toBe('my-api-key');
  });

  it('validates all platform enums', () => {
    for (const p of ['tookan', 'onfleet', 'optimoroute', 'speedyroute', 'getswift', 'circuit']) {
      expect(migrationPlatformEnum.parse(p)).toBe(p);
    }
  });

  it('rejects invalid platform', () => {
    expect(() => migrationPlatformEnum.parse('doordash')).toThrow();
  });

  it('validates csvData schema independently', () => {
    const result = migrationCsvDataSchema.parse({
      orders: [{ name: 'Test' }],
      drivers: [{ name: 'Driver 1' }],
    });
    expect(result?.orders).toHaveLength(1);
    expect(result?.drivers).toHaveLength(1);
    expect(result?.vehicles).toBeUndefined();
  });
});

// ─── Service Logic Tests ──────────────────────────────────────────────────────

describe('Migration service', () => {
  it('formatJob strips apiKey from response config', async () => {
    const { getMigrationJob } = await import('../modules/migration/service.js');
    const result = await getMigrationJob('tenant-1', 'mig-1');
    // apiKey should not appear in the returned config
    expect((result.config as Record<string, unknown>).apiKey).toBeUndefined();
  });

  it('cancelMigrationJob rejects wrong status', async () => {
    // Set mock to return a completed job
    mockSelectLimit.mockResolvedValueOnce([{
      id: 'mig-1',
      tenantId: 'tenant-1',
      sourcePlatform: 'tookan',
      status: 'completed',
      config: {},
      progress: {},
      startedAt: null,
      completedAt: new Date(),
      errorLog: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);

    const { cancelMigrationJob } = await import('../modules/migration/service.js');
    await expect(cancelMigrationJob('tenant-1', 'mig-1')).rejects.toThrow(
      "Cannot cancel job with status 'completed'",
    );
  });

  it('deleteMigrationJob rejects active jobs', async () => {
    // Set mock to return an in_progress job
    mockSelectLimit.mockResolvedValueOnce([{
      id: 'mig-1',
      tenantId: 'tenant-1',
      sourcePlatform: 'tookan',
      status: 'in_progress',
      config: {},
      progress: {},
      startedAt: new Date(),
      completedAt: null,
      errorLog: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);

    const { deleteMigrationJob } = await import('../modules/migration/service.js');
    await expect(deleteMigrationJob('tenant-1', 'mig-1')).rejects.toThrow(
      "Cannot delete active job with status 'in_progress'",
    );
  });

  it('createMigrationJob enqueues BullMQ job', async () => {
    const { createMigrationJob } = await import('../modules/migration/service.js');
    await createMigrationJob('tenant-1', 'user-1', {
      sourcePlatform: 'tookan',
      config: { importOrders: true, importDrivers: false, importVehicles: false },
      csvData: { orders: [{ name: 'Test Order' }] },
    });

    expect(mockQueueAdd).toHaveBeenCalledWith('migration', {
      migrationJobId: 'mig-1',
      tenantId: 'tenant-1',
    });
  });

  it('createMigrationJob encrypts apiKey', async () => {
    const { createMigrationJob } = await import('../modules/migration/service.js');
    await createMigrationJob('tenant-1', 'user-1', {
      sourcePlatform: 'onfleet',
      config: { apiKey: 'secret123', importOrders: true, importDrivers: false, importVehicles: false },
    });

    // Check the values passed to db.insert
    const insertedConfig = mockValues.mock.calls[0][0].config;
    expect(insertedConfig.apiKey).toBe('enc:secret123');
  });

  it('createMigrationJob logs activity', async () => {
    const { createMigrationJob } = await import('../modules/migration/service.js');
    await createMigrationJob('tenant-1', 'user-1', {
      sourcePlatform: 'tookan',
      config: { importOrders: true, importDrivers: false, importVehicles: false },
    });

    expect(mockLogActivity).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      userId: 'user-1',
      action: 'create',
      entityType: 'migration_job',
      entityId: 'mig-1',
      metadata: { sourcePlatform: 'tookan' },
    });
  });
});
