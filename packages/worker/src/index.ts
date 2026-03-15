import { Worker, Queue } from 'bullmq';
import { config } from './lib/config.js';
import { processOptimization } from './workers/optimization.js';
import { processNotification } from './workers/notification.js';
import { processAnalytics } from './workers/analytics.js';
import { processCustomerNotification } from './workers/customer-notification.js';
import { processWebhookDelivery } from './workers/webhook-delivery.js';
import { processBillingUsage } from './workers/billing-usage.js';
import { processIntegrationSync } from './workers/integration-sync.js';
import { processReportGeneration } from './workers/report-generation.js';

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

// Event logging
const allWorkers = [
  optimizationWorker, notificationWorker, analyticsWorker,
  customerNotificationWorker, webhookDeliveryWorker,
  billingUsageWorker, integrationSyncWorker, reportGenerationWorker,
];

for (const worker of allWorkers) {
  worker.on('completed', (job) => {
    console.log(`Job ${job.id} in ${worker.name} completed`);
  });
  worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} in ${worker.name} failed:`, err.message);
  });
}

console.log('HOMER.io Worker started — listening for jobs (8 queues)');

// Graceful shutdown
const signals = ['SIGINT', 'SIGTERM'] as const;
for (const signal of signals) {
  process.on(signal, async () => {
    console.log(`Received ${signal}, closing workers...`);
    await Promise.all(allWorkers.map(w => w.close()));
    process.exit(0);
  });
}
