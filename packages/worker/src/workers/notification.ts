import type { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { notifications, users, deviceTokens } from '../lib/schema.js';
import { sendEmail } from './providers/email.js';
import { sendPushNotifications } from './providers/push.js';
import { config } from '../lib/config.js';
import { logger } from '../lib/logger.js';

interface NotificationJobData {
  tenantId: string;
  userId: string;
  type: 'delivery_completed' | 'delivery_failed' | 'route_started' | 'route_completed' | 'driver_offline' | 'system' | 'team_invite' | 'order_received';
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

const EMAIL_WORTHY_TYPES = new Set([
  'delivery_completed',
  'delivery_failed',
  'route_started',
  'route_completed',
  'team_invite',
]);

const log = logger.child({ worker: 'notification' });

export async function processNotification(job: Job<NotificationJobData>) {
  const { tenantId, userId, type, title, body, data } = job.data;
  log.info('Processing notification', { type, userId });

  // Insert into notifications table
  await db.insert(notifications).values({
    tenantId,
    userId,
    type,
    title,
    body,
    data: data ?? {},
  });

  log.info('Saved notification', { title, userId });

  // Send push notification to mobile devices
  const tokens = await db
    .select({ token: deviceTokens.token })
    .from(deviceTokens)
    .where(eq(deviceTokens.userId, userId));

  if (tokens.length > 0) {
    await sendPushNotifications(
      tokens.map((t) => t.token),
      title,
      body,
      { type, ...data },
    ).catch(err =>
      log.error('Push notification failed', { userId, error: err instanceof Error ? err.message : 'Unknown error' }),
    );
  }

  // Send email for important notification types
  if (EMAIL_WORTHY_TYPES.has(type)) {
    const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
    if (user?.email) {
      await sendEmail(user.email, title, body, config.sendgrid).catch(err =>
        log.error('Email failed', { userId, error: err instanceof Error ? err.message : 'Unknown error' }),
      );
    }
  }

  return { sent: true, type, userId };
}
