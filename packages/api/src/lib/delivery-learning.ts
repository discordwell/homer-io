import { Queue } from 'bullmq';
import { config } from '../config.js';

const deliveryLearningQueue = new Queue('delivery-learning', {
  connection: { url: config.redis.url },
});

export interface DeliveryLearningJobData {
  tenantId: string;
  orderId: string;
  routeId: string;
  status: 'delivered' | 'failed';
  failureReason?: string;
  completedAt: string;
}

export async function enqueueDeliveryLearning(
  tenantId: string,
  orderId: string,
  routeId: string,
  status: 'delivered' | 'failed',
  failureReason?: string,
  completedAt?: Date,
): Promise<void> {
  await deliveryLearningQueue.add('learn', {
    tenantId,
    orderId,
    routeId,
    status,
    failureReason,
    completedAt: (completedAt ?? new Date()).toISOString(),
  } satisfies DeliveryLearningJobData);
}
