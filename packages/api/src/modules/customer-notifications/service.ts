import { eq, and, desc, sql } from 'drizzle-orm';
import { Queue } from 'bullmq';
import type { CreateNotificationTemplateInput, UpdateNotificationTemplateInput } from '@homer-io/shared';
import { db } from '../../lib/db/index.js';
import { notificationTemplates } from '../../lib/db/schema/notification-templates.js';
import { customerNotificationsLog } from '../../lib/db/schema/customer-notifications-log.js';
import { orders } from '../../lib/db/schema/orders.js';
import { NotFoundError } from '../../lib/errors.js';
import { config } from '../../config.js';

const customerNotificationQueue = new Queue('customer-notifications', {
  connection: { url: config.redis.url },
});

export async function listTemplates(tenantId: string) {
  return db
    .select()
    .from(notificationTemplates)
    .where(eq(notificationTemplates.tenantId, tenantId))
    .orderBy(desc(notificationTemplates.createdAt));
}

export async function createTemplate(tenantId: string, input: CreateNotificationTemplateInput) {
  const [template] = await db
    .insert(notificationTemplates)
    .values({
      tenantId,
      trigger: input.trigger,
      channel: input.channel,
      subject: input.subject ?? null,
      bodyTemplate: input.bodyTemplate,
      isActive: input.isActive ?? true,
    })
    .returning();

  return template;
}

export async function updateTemplate(
  tenantId: string,
  id: string,
  input: UpdateNotificationTemplateInput,
) {
  const [template] = await db
    .update(notificationTemplates)
    .set({
      ...input,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(notificationTemplates.id, id),
        eq(notificationTemplates.tenantId, tenantId),
      ),
    )
    .returning();

  if (!template) {
    throw new NotFoundError('Template not found');
  }

  return template;
}

export async function deleteTemplate(tenantId: string, id: string) {
  const result = await db
    .delete(notificationTemplates)
    .where(
      and(
        eq(notificationTemplates.id, id),
        eq(notificationTemplates.tenantId, tenantId),
      ),
    )
    .returning({ id: notificationTemplates.id });

  if (result.length === 0) {
    throw new NotFoundError('Template not found');
  }
}

export async function sendTestNotification(tenantId: string, templateId: string) {
  const [template] = await db
    .select()
    .from(notificationTemplates)
    .where(
      and(
        eq(notificationTemplates.id, templateId),
        eq(notificationTemplates.tenantId, tenantId),
      ),
    )
    .limit(1);

  if (!template) {
    throw new NotFoundError('Template not found');
  }

  // Sample data for variable substitution
  const sampleData = {
    recipientName: 'Jane Doe',
    driverName: 'John Smith',
    eta: '2:30 PM',
    trackingUrl: 'https://track.homer.io/demo-abc123',
    orderRef: 'ORD-00042',
  };

  let body = template.bodyTemplate;
  for (const [key, value] of Object.entries(sampleData)) {
    body = body.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }

  console.log(`[test-notification] Channel: ${template.channel}`);
  console.log(`[test-notification] Subject: ${template.subject ?? '(none)'}`);
  console.log(`[test-notification] Body: ${body}`);
  console.log(`[test-notification] Test notification logged (no actual send — provider may not be configured)`);

  return { success: true, message: 'Test sent', renderedBody: body };
}

export async function listNotificationLog(
  tenantId: string,
  pagination: { page: number; limit: number },
) {
  const { page, limit } = pagination;
  const offset = (page - 1) * limit;

  const [items, countResult] = await Promise.all([
    db
      .select()
      .from(customerNotificationsLog)
      .where(eq(customerNotificationsLog.tenantId, tenantId))
      .orderBy(desc(customerNotificationsLog.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(customerNotificationsLog)
      .where(eq(customerNotificationsLog.tenantId, tenantId)),
  ]);

  const total = countResult[0]?.count ?? 0;

  return {
    data: items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function enqueueCustomerNotification(
  tenantId: string,
  orderId: string,
  trigger: string,
) {
  // Find active templates matching this trigger
  const templates = await db
    .select()
    .from(notificationTemplates)
    .where(
      and(
        eq(notificationTemplates.tenantId, tenantId),
        eq(notificationTemplates.trigger, trigger as any),
        eq(notificationTemplates.isActive, true),
      ),
    );

  if (templates.length === 0) {
    console.log(`[customer-notification] No active templates for trigger "${trigger}"`);
    return;
  }

  // Get order details for variable substitution — enforce tenant isolation
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.tenantId, tenantId)))
    .limit(1);

  if (!order) {
    console.error(`[customer-notification] Order ${orderId} not found`);
    return;
  }

  // Determine recipient based on channel
  for (const template of templates) {
    const recipient =
      template.channel === 'sms'
        ? (order.recipientPhone || '')
        : (order.recipientEmail || '');

    if (!recipient) {
      console.log(
        `[customer-notification] No ${template.channel} recipient for order ${orderId}, skipping template ${template.id}`,
      );
      continue;
    }

    // Render template variables
    const vars: Record<string, string> = {
      recipientName: order.recipientName || 'Customer',
      driverName: 'Your Driver',
      eta: 'soon',
      trackingUrl: `https://track.homer.io/${orderId}`,
      orderRef: order.externalId || orderId.slice(0, 8),
    };

    let body = template.bodyTemplate;
    let subject = template.subject || '';
    for (const [key, value] of Object.entries(vars)) {
      body = body.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
      subject = subject.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }

    // Create log entry with status 'queued'
    const [logEntry] = await db
      .insert(customerNotificationsLog)
      .values({
        tenantId,
        orderId,
        channel: template.channel,
        trigger,
        recipient,
        subject: subject || null,
        body,
        status: 'queued',
      })
      .returning();

    // Enqueue BullMQ job
    await customerNotificationQueue.add(
      `customer-${trigger}`,
      {
        tenantId,
        orderId,
        trigger,
        logId: logEntry.id,
        templateId: template.id,
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
    );

    console.log(
      `[customer-notification] Enqueued ${template.channel} notification for order ${orderId} (trigger: ${trigger})`,
    );
  }
}
