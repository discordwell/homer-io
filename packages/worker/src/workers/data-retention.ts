import type { Job } from 'bullmq';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { lt, sql, and, eq } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { locationHistory, activityLog, customerNotificationsLog, webhookDeliveries, passwordResetTokens, tenants } from '../lib/schema.js';
import { logger } from '../lib/logger.js';

const POLICIES = [
  { name: 'location_history', table: locationHistory, days: 90, dateColumn: locationHistory.timestamp as PgColumn },
  { name: 'activity_log', table: activityLog, days: 365, dateColumn: activityLog.createdAt as PgColumn },
  { name: 'customer_notifications_log', table: customerNotificationsLog, days: 180, dateColumn: customerNotificationsLog.createdAt as PgColumn },
  { name: 'webhook_deliveries', table: webhookDeliveries, days: 90, dateColumn: webhookDeliveries.createdAt as PgColumn },
  { name: 'password_reset_tokens', table: passwordResetTokens, days: 7, dateColumn: passwordResetTokens.createdAt as PgColumn },
];

const log = logger.child({ worker: 'data-retention' });

export async function processDataRetention(job: Job) {
  log.info('Running data retention cleanup');
  const results: Record<string, number> = {};

  for (const policy of POLICIES) {
    const cutoff = new Date(Date.now() - policy.days * 24 * 60 * 60 * 1000);
    try {
      // Count before delete to avoid loading all IDs into memory
      const [countResult] = await db.select({ count: sql<number>`count(*)` })
        .from(policy.table)
        .where(lt(policy.dateColumn, cutoff));
      const toDelete = Number(countResult.count);

      if (toDelete > 0) {
        await db.delete(policy.table)
          .where(lt(policy.dateColumn, cutoff));
      }

      results[policy.name] = toDelete;
      log.info('Retention cleanup complete for table', {
        table: policy.name,
        deletedRows: toDelete,
        retentionDays: policy.days,
      });
    } catch (err) {
      log.error('Retention cleanup failed for table', {
        table: policy.name,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      results[policy.name] = -1;
    }
  }

  // --- Demo tenant cleanup: delete demo tenants older than 7 days ---
  // FK cascades handle all child records (orders, routes, drivers, etc.)
  try {
    const demoCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [countResult] = await db.select({ count: sql<number>`count(*)` })
      .from(tenants)
      .where(and(eq(tenants.isDemo, true), lt(tenants.createdAt, demoCutoff)));
    const toDelete = Number(countResult.count);

    if (toDelete > 0) {
      await db.delete(tenants)
        .where(and(eq(tenants.isDemo, true), lt(tenants.createdAt, demoCutoff)));
    }

    results['demo_tenants'] = toDelete;
    log.info('Demo tenant cleanup complete', { deletedTenants: toDelete });
  } catch (err) {
    log.error('Demo tenant cleanup failed', {
      error: err instanceof Error ? err.message : 'Unknown error',
    });
    results['demo_tenants'] = -1;
  }

  return results;
}
