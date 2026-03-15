import type { Job } from 'bullmq';
import { lt, sql } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { locationHistory, activityLog, customerNotificationsLog, webhookDeliveries } from '../lib/schema.js';
import { logger } from '../lib/logger.js';

const POLICIES = [
  { name: 'location_history', table: locationHistory, days: 90 },
  { name: 'activity_log', table: activityLog, days: 365 },
  { name: 'customer_notifications_log', table: customerNotificationsLog, days: 180 },
  { name: 'webhook_deliveries', table: webhookDeliveries, days: 90 },
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
        .where(lt(policy.table.createdAt, cutoff));
      const toDelete = Number(countResult.count);

      if (toDelete > 0) {
        await db.delete(policy.table)
          .where(lt(policy.table.createdAt, cutoff));
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

  return results;
}
