import { Job } from 'bullmq';
import { db } from '../lib/db.js';
import { notifications } from '../lib/schema.js';

interface NotificationJobData {
  tenantId: string;
  userId: string;
  type: 'delivery_completed' | 'delivery_failed' | 'route_started' | 'route_completed' | 'driver_offline' | 'system' | 'team_invite' | 'order_received';
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export async function processNotification(job: Job<NotificationJobData>) {
  const { tenantId, userId, type, title, body, data } = job.data;
  console.log(`[notification] Processing ${type} notification for user ${userId}`);

  // Insert into notifications table
  await db.insert(notifications).values({
    tenantId,
    userId,
    type,
    title,
    body,
    data: data ?? {},
  });

  console.log(`[notification] Saved notification: "${title}" for user ${userId}`);

  // Future: send email/SMS via Twilio/SendGrid
  // For now, just log
  console.log(`[notification] TODO: Send ${type} notification via email/SMS to user ${userId}`);

  return { sent: true, type, userId };
}
