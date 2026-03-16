import { eq, and, desc, sql } from 'drizzle-orm';
import { Queue } from 'bullmq';
import { db } from '../../lib/db/index.js';
import { migrationJobs } from '../../lib/db/schema/migration-jobs.js';
import type { CreateMigrationJobInput } from '@homer-io/shared';
import { HttpError } from '../../lib/errors.js';
import { logActivity } from '../../lib/activity.js';
import { encrypt } from '../../lib/integrations/crypto.js';
import { config } from '../../config.js';
import { getMigrationConnector, getMigrationPlatformInfo, apiMigrationPlatforms } from '../../lib/migration-connectors/index.js';

// ─── BullMQ queue ─────────────────────────────────────────────────────────────

const migrationQueue = new Queue('migration', {
  connection: { url: config.redis.url },
});

// ─── Formatting ───────────────────────────────────────────────────────────────

function formatJob(job: typeof migrationJobs.$inferSelect) {
  const cfg = job.config as Record<string, unknown>;
  // Strip sensitive fields from response
  const { apiKey, ...safeConfig } = cfg;
  // Also strip csvData from list responses (can be large)
  const { csvData, ...configWithoutCsv } = safeConfig;
  return {
    id: job.id,
    tenantId: job.tenantId,
    sourcePlatform: job.sourcePlatform,
    status: job.status,
    config: configWithoutCsv,
    progress: job.progress,
    startedAt: job.startedAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null,
    errorLog: job.errorLog,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function createMigrationJob(
  tenantId: string,
  userId: string,
  input: CreateMigrationJobInput,
) {
  // Build config jsonb — encrypt apiKey if present, merge csvData
  const configData: Record<string, unknown> = { ...input.config };
  if (configData.apiKey && typeof configData.apiKey === 'string') {
    configData.apiKey = encrypt(configData.apiKey);
  }
  if (input.csvData) {
    configData.csvData = input.csvData;
  }

  const [created] = await db
    .insert(migrationJobs)
    .values({
      tenantId,
      sourcePlatform: input.sourcePlatform,
      status: 'pending',
      config: configData,
      progress: {
        orders: { total: input.csvData?.orders?.length ?? 0, imported: 0, failed: 0 },
        drivers: { total: input.csvData?.drivers?.length ?? 0, imported: 0, failed: 0 },
        vehicles: { total: input.csvData?.vehicles?.length ?? 0, imported: 0, failed: 0 },
      },
    })
    .returning();

  // Enqueue BullMQ job
  await migrationQueue.add('migration', {
    migrationJobId: created.id,
    tenantId,
  });

  await logActivity({
    tenantId,
    userId,
    action: 'create',
    entityType: 'migration_job',
    entityId: created.id,
    metadata: { sourcePlatform: input.sourcePlatform },
  });

  return formatJob(created);
}

export async function listMigrationJobs(tenantId: string, page: number = 1, limit: number = 20) {
  const offset = (page - 1) * limit;

  const [items, countResult] = await Promise.all([
    db.select()
      .from(migrationJobs)
      .where(eq(migrationJobs.tenantId, tenantId))
      .orderBy(desc(migrationJobs.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)::int` })
      .from(migrationJobs)
      .where(eq(migrationJobs.tenantId, tenantId)),
  ]);

  const total = countResult[0]?.count ?? 0;
  const totalPages = Math.ceil(total / limit);

  return {
    data: items.map(formatJob),
    pagination: { page, limit, total, totalPages },
  };
}

export async function getMigrationJob(tenantId: string, id: string) {
  const [job] = await db
    .select()
    .from(migrationJobs)
    .where(and(eq(migrationJobs.id, id), eq(migrationJobs.tenantId, tenantId)))
    .limit(1);

  if (!job) {
    throw new HttpError(404, 'Migration job not found');
  }

  return formatJob(job);
}

export async function cancelMigrationJob(tenantId: string, id: string) {
  const [job] = await db
    .select()
    .from(migrationJobs)
    .where(and(eq(migrationJobs.id, id), eq(migrationJobs.tenantId, tenantId)))
    .limit(1);

  if (!job) {
    throw new HttpError(404, 'Migration job not found');
  }

  if (job.status !== 'pending' && job.status !== 'in_progress') {
    throw new HttpError(400, `Cannot cancel job with status '${job.status}'`);
  }

  const [updated] = await db
    .update(migrationJobs)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(and(eq(migrationJobs.id, id), eq(migrationJobs.tenantId, tenantId)))
    .returning();

  return formatJob(updated);
}

export async function deleteMigrationJob(tenantId: string, id: string) {
  const [job] = await db
    .select()
    .from(migrationJobs)
    .where(and(eq(migrationJobs.id, id), eq(migrationJobs.tenantId, tenantId)))
    .limit(1);

  if (!job) {
    throw new HttpError(404, 'Migration job not found');
  }

  const terminalStatuses = ['completed', 'failed', 'cancelled'];
  if (!terminalStatuses.includes(job.status)) {
    throw new HttpError(400, `Cannot delete active job with status '${job.status}'`);
  }

  await db
    .delete(migrationJobs)
    .where(and(eq(migrationJobs.id, id), eq(migrationJobs.tenantId, tenantId)));
}

// ─── API Credential Validation ───────────────────────────────────────────────

export async function validateMigrationCredentials(platform: string, apiKey: string) {
  if (!apiMigrationPlatforms.includes(platform)) {
    throw new HttpError(400, `Platform '${platform}' does not support API import`);
  }

  const connector = getMigrationConnector(platform);
  if (!connector) {
    throw new HttpError(400, `No connector available for platform '${platform}'`);
  }

  const valid = await connector.validateCredentials(apiKey);
  if (!valid) {
    return { valid: false, message: 'Invalid API credentials' };
  }

  const counts = await connector.getCounts(apiKey);
  return { valid: true, counts };
}

export { getMigrationPlatformInfo };
