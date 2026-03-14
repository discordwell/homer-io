import { Worker, Queue } from 'bullmq';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = { url: redisUrl };

// Queue definitions
export const optimizationQueue = new Queue('route-optimization', { connection });
export const notificationQueue = new Queue('notifications', { connection });
export const analyticsQueue = new Queue('analytics', { connection });

// Workers
const optimizationWorker = new Worker('route-optimization', async (job) => {
  console.log(`Processing route optimization job ${job.id}`, job.data);
  // TODO: Implement with OR-Tools / Claude API
  return { optimized: true, routeId: job.data.routeId };
}, { connection, concurrency: 2 });

const notificationWorker = new Worker('notifications', async (job) => {
  console.log(`Processing notification job ${job.id}`, job.data);
  // TODO: Implement with Twilio/SendGrid
  return { sent: true, type: job.data.type };
}, { connection, concurrency: 5 });

const analyticsWorker = new Worker('analytics', async (job) => {
  console.log(`Processing analytics job ${job.id}`, job.data);
  // TODO: Implement analytics aggregation
  return { aggregated: true };
}, { connection, concurrency: 1 });

// Event logging
for (const worker of [optimizationWorker, notificationWorker, analyticsWorker]) {
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
    ]);
    process.exit(0);
  });
}
