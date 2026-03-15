import { Queue } from 'bullmq';
import { config } from '../../config.js';

const connection = { url: config.redis.url };

const reportQueue = new Queue('report-generation', { connection });

export interface ReportScheduleInput {
  type: 'daily-summary' | 'driver-performance' | 'route-efficiency';
  /** Cron expression for the schedule, e.g. "0 6 * * *" for daily at 6am */
  cron: string;
  /** Optional date range offsets (used for performance/efficiency reports) */
  rangeDays?: number;
  /** Email recipients for the generated report */
  recipients?: string[];
}

/**
 * Schedule a repeatable BullMQ job that generates a report on a cron schedule.
 * The job key is scoped by tenantId + report type so each tenant can have
 * one schedule per report type.
 */
export async function scheduleReport(tenantId: string, input: ReportScheduleInput): Promise<void> {
  const jobId = `report:${tenantId}:${input.type}`;

  // Remove any existing schedule for this tenant+type first
  await unscheduleReport(tenantId, input.type);

  await reportQueue.add(
    input.type,
    {
      tenantId,
      type: input.type,
      rangeDays: input.rangeDays || 30,
      recipients: input.recipients || [],
    },
    {
      repeat: {
        pattern: input.cron,
        key: jobId,
      },
      jobId,
    },
  );

  console.log(`[reports] Scheduled ${input.type} for tenant ${tenantId} with cron "${input.cron}"`);
}

/**
 * Remove a scheduled report for a specific tenant and report type.
 */
export async function unscheduleReport(tenantId: string, type: string): Promise<void> {
  const jobKey = `report:${tenantId}:${type}`;
  const repeatableJobs = await reportQueue.getRepeatableJobs();

  for (const job of repeatableJobs) {
    if (job.key === jobKey || job.id === jobKey) {
      await reportQueue.removeRepeatableByKey(job.key);
      console.log(`[reports] Unscheduled ${type} for tenant ${tenantId}`);
    }
  }
}
