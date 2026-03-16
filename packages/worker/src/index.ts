import { Worker, Queue } from 'bullmq';
import { config } from './lib/config.js';
import { logger } from './lib/logger.js';
import { processOptimization } from './workers/optimization.js';
import { processNotification } from './workers/notification.js';
import { processAnalytics } from './workers/analytics.js';
import { processCustomerNotification } from './workers/customer-notification.js';
import { processWebhookDelivery } from './workers/webhook-delivery.js';
import { processBillingUsage } from './workers/billing-usage.js';
import { processIntegrationSync } from './workers/integration-sync.js';
import { processReportGeneration } from './workers/report-generation.js';
import { processRouteTemplate } from './workers/route-template.js';
import { processDataExport } from './workers/data-export.js';
import { processDataRetention } from './workers/data-retention.js';
import { processDeliveryLearning } from './workers/delivery-learning.js';
import { processMigration } from './workers/migration.js';

const connection = { url: config.redis.url };

// Queue definitions
export const optimizationQueue = new Queue('route-optimization', { connection });
export const notificationQueue = new Queue('notifications', { connection });
export const analyticsQueue = new Queue('analytics', { connection });
export const customerNotificationQueue = new Queue('customer-notifications', { connection });
export const webhookDeliveryQueue = new Queue('webhook-delivery', { connection });
export const billingUsageQueue = new Queue('billing-usage', { connection });
export const integrationSyncQueue = new Queue('integration-sync', { connection });
export const reportGenerationQueue = new Queue('report-generation', { connection });
export const routeTemplateQueue = new Queue('route-template', { connection });
export const dataExportQueue = new Queue('data-export', { connection });
export const dataRetentionQueue = new Queue('data-retention', { connection });
export const deliveryLearningQueue = new Queue('delivery-learning', { connection });
export const migrationQueue = new Queue('migration', { connection });

// Workers
const optimizationWorker = new Worker('route-optimization', processOptimization, {
  connection,
  concurrency: 2,
});

const notificationWorker = new Worker('notifications', processNotification, {
  connection,
  concurrency: 5,
});

const analyticsWorker = new Worker('analytics', processAnalytics, {
  connection,
  concurrency: 1,
});

const customerNotificationWorker = new Worker('customer-notifications', processCustomerNotification, {
  connection,
  concurrency: 5,
});

const webhookDeliveryWorker = new Worker('webhook-delivery', processWebhookDelivery, {
  connection,
  concurrency: 10,
});

const billingUsageWorker = new Worker('billing-usage', processBillingUsage, {
  connection,
  concurrency: 1,
});

const integrationSyncWorker = new Worker('integration-sync', processIntegrationSync, {
  connection,
  concurrency: 3,
});

const reportGenerationWorker = new Worker('report-generation', processReportGeneration, {
  connection,
  concurrency: 2,
});

const routeTemplateWorker = new Worker('route-template', processRouteTemplate, { connection, concurrency: 1 });
const dataExportWorker = new Worker('data-export', processDataExport, { connection, concurrency: 1 });
const dataRetentionWorker = new Worker('data-retention', processDataRetention, { connection, concurrency: 1 });
const deliveryLearningWorker = new Worker('delivery-learning', processDeliveryLearning, { connection, concurrency: 3 });
const migrationWorker = new Worker('migration', processMigration, { connection, concurrency: 1 });

// Event logging
const allWorkers = [
  optimizationWorker, notificationWorker, analyticsWorker,
  customerNotificationWorker, webhookDeliveryWorker,
  billingUsageWorker, integrationSyncWorker, reportGenerationWorker,
  routeTemplateWorker, dataExportWorker, dataRetentionWorker,
  deliveryLearningWorker, migrationWorker,
];

for (const worker of allWorkers) {
  worker.on('completed', (job) => {
    logger.info('Job completed', { jobId: job.id, queue: worker.name });
  });
  worker.on('failed', (job, err) => {
    logger.error('Job failed', { jobId: job?.id, queue: worker.name, error: err.message });
  });
}

// Cron job schedulers
await billingUsageQueue.upsertJobScheduler('billing-usage-daily', { pattern: '0 2 * * *' }, { name: 'billing-usage-cron' });
await integrationSyncQueue.upsertJobScheduler('integration-sync-periodic', { every: 900000 }, { name: 'integration-sync-cron' });
await reportGenerationQueue.upsertJobScheduler('report-generation-daily', { pattern: '0 6 * * *' }, { name: 'report-generation-cron' });
await routeTemplateQueue.upsertJobScheduler('route-template-periodic', { every: 300000 }, { name: 'route-template-cron' });
await dataRetentionQueue.upsertJobScheduler('data-retention-daily', { pattern: '0 3 * * *' }, { name: 'data-retention-cron' });

logger.info('HOMER.io Worker started', { queues: 13 });

// Graceful shutdown
const signals = ['SIGINT', 'SIGTERM'] as const;
for (const signal of signals) {
  process.on(signal, async () => {
    logger.info('Shutting down', { signal });
    await Promise.all(allWorkers.map(w => w.close()));
    process.exit(0);
  });
}
