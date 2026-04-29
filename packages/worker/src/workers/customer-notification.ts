import type { Job } from 'bullmq';
import { eq, and } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { customerNotificationsLog } from '../lib/schema.js';
import { config } from '../lib/config.js';
import { sendSms } from './providers/sms.js';
import { sendEmail } from './providers/email.js';
import { logger } from '../lib/logger.js';

interface CustomerNotificationJobData {
  tenantId: string;
  orderId: string;
  trigger: string;
  logId: string;
  templateId: string;
}

const log = logger.child({ worker: 'customer-notification' });

export async function processCustomerNotification(job: Job<CustomerNotificationJobData>) {
  const { tenantId, orderId, trigger, logId } = job.data;
  log.info('Processing customer notification', { trigger, orderId, logId });

  // Get the log entry — enforce tenant isolation
  const [logEntry] = await db
    .select()
    .from(customerNotificationsLog)
    .where(and(eq(customerNotificationsLog.id, logId), eq(customerNotificationsLog.tenantId, tenantId)))
    .limit(1);

  if (!logEntry) {
    log.error('Log entry not found', { logId });
    return;
  }

  // Send based on channel
  let result;
  if (logEntry.channel === 'sms') {
    result = await sendSms(logEntry.recipient, logEntry.body, config.twilio);
  } else {
    result = await sendEmail(
      logEntry.recipient,
      logEntry.subject || '',
      logEntry.body,
      config.sendgrid,
    );
  }

  // Update log entry
  const now = new Date();
  await db
    .update(customerNotificationsLog)
    .set({
      status: result.success ? 'sent' : 'failed',
      providerId: result.providerId || null,
      errorMessage: result.error || null,
      sentAt: result.success ? now : null,
    })
    .where(eq(customerNotificationsLog.id, logId));

  log.info('Customer notification processed', {
    trigger,
    orderId,
    success: result.success,
    channel: logEntry.channel,
  });

  return result;
}
