import { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { customerNotificationsLog } from '../lib/schema.js';
import { config } from '../lib/config.js';
import { sendSms } from './providers/sms.js';
import { sendEmail } from './providers/email.js';

interface CustomerNotificationJobData {
  tenantId: string;
  orderId: string;
  trigger: string;
  logId: string;
  templateId: string;
}

export async function processCustomerNotification(job: Job<CustomerNotificationJobData>) {
  const { tenantId, orderId, trigger, logId, templateId } = job.data;
  console.log(`[customer-notification] Processing ${trigger} for order ${orderId}`);

  // Get the log entry
  const [logEntry] = await db
    .select()
    .from(customerNotificationsLog)
    .where(eq(customerNotificationsLog.id, logId))
    .limit(1);

  if (!logEntry) {
    console.error(`[customer-notification] Log entry ${logId} not found`);
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

  console.log(
    `[customer-notification] ${trigger} ${result.success ? 'sent' : 'failed'} for order ${orderId}`,
  );

  return result;
}
