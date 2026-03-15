import { Worker, Queue } from 'bullmq';
import { config } from './lib/config.js';
import { processOptimization } from './workers/optimization.js';
import { processNotification } from './workers/notification.js';
import { processAnalytics } from './workers/analytics.js';
import { processCustomerNotification } from './workers/customer-notification.js';
import { processWebhookDelivery } from './workers/webhook-delivery.js';

const connection = { url: config.redis.url };

// Queue definitions
export const optimizationQueue = new Queue('route-optimization', { connection });
export const notificationQueue = new Queue('notifications', { connection });
export const analyticsQueue = new Queue('analytics', { connection });
export const customerNotificationQueue = new Queue('customer-notifications', { connection });
export const webhookDeliveryQueue = new Queue('webhook-delivery', { connection });

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

// Event logging
for (const worker of [optimizationWorker, notificationWorker, analyticsWorker, customerNotificationWorker, webhookDeliveryWorker]) {
  worker.on('completed', (job) => {
    console.log(`Job ${job.id} in ${worker.name} completed`);
  });
  worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} in ${worker.name} failed:`, err.message);
  });
}

console.log('HOMER.io Worker started — listening for jobs');

// Graceful shutdown
const signals = ['SIGINT', 'SIGTERM'] as const;
for (const signal of signals) {
  process.on(signal, async () => {
    console.log(`Received ${signal}, closing workers...`);
    await Promise.all([
      optimizationWorker.close(),
      notificationWorker.close(),
      analyticsWorker.close(),
      customerNotificationWorker.close(),
      webhookDeliveryWorker.close(),
    ]);
    process.exit(0);
  });
}
