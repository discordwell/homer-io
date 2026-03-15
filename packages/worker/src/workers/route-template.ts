import type { Job } from 'bullmq';
import { eq, and, lte } from 'drizzle-orm';
import { parseExpression } from 'cron-parser';
import { db } from '../lib/db.js';
import { routeTemplatesTable, orders, routes } from '../lib/schema.js';
import { logger } from '../lib/logger.js';

const log = logger.child({ worker: 'route-template' });

export async function processRouteTemplate(job: Job) {
  log.info('Checking for templates to generate');

  const now = new Date();
  const dueTemplates = await db.select().from(routeTemplatesTable)
    .where(and(
      eq(routeTemplatesTable.isActive, true),
      lte(routeTemplatesTable.nextGenerateAt, now),
    ));

  log.info('Found due templates', { count: dueTemplates.length });

  for (const template of dueTemplates) {
    try {
      const orderItems = template.orderTemplate as Array<Record<string, unknown>>;

      // Create orders + route
      const createdOrderIds: string[] = [];
      for (const item of orderItems) {
        const [order] = await db.insert(orders).values({
          tenantId: template.tenantId,
          recipientName: (item.recipientName as string) || 'Template Order',
          deliveryAddress: item.deliveryAddress ?? { street: '', city: '', state: '', zip: '' },
        }).returning();
        createdOrderIds.push(order.id);
      }

      const [route] = await db.insert(routes).values({
        tenantId: template.tenantId,
        name: `${template.name} - ${now.toLocaleDateString()}`,
        driverId: template.driverId,
        totalStops: createdOrderIds.length,
      }).returning();

      for (let i = 0; i < createdOrderIds.length; i++) {
        await db.update(orders).set({
          routeId: route.id, stopSequence: i + 1, status: 'assigned', updatedAt: now,
        }).where(eq(orders.id, createdOrderIds[i]));
      }

      // Update template
      const interval = parseExpression(template.recurrenceRule, { tz: template.recurrenceTimezone });
      const nextGenerateAt = interval.next().toDate();
      await db.update(routeTemplatesTable).set({
        lastGeneratedAt: now, nextGenerateAt, updatedAt: now,
      }).where(eq(routeTemplatesTable.id, template.id));

      log.info('Generated route from template', { routeName: route.name, templateName: template.name });
    } catch (err) {
      log.error('Failed to generate from template', {
        templateName: template.name,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  return { processed: dueTemplates.length };
}
