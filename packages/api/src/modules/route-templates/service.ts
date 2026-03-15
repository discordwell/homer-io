import { eq, and, sql, lte } from 'drizzle-orm';
import cronParser from 'cron-parser';
const { parseExpression } = cronParser;
import type { CreateRouteTemplateInput, PaginationInput } from '@homer-io/shared';
import { db } from '../../lib/db/index.js';
import { routeTemplates } from '../../lib/db/schema/route-templates.js';
import { orders } from '../../lib/db/schema/orders.js';
import { routes } from '../../lib/db/schema/routes.js';
import { NotFoundError } from '../../lib/errors.js';
import { logActivity } from '../../lib/activity.js';

function computeNextGenerate(rule: string, timezone: string): Date {
  const interval = parseExpression(rule, { tz: timezone });
  return interval.next().toDate();
}

export async function createTemplate(tenantId: string, input: CreateRouteTemplateInput) {
  const nextGenerateAt = computeNextGenerate(input.recurrenceRule, input.recurrenceTimezone || 'UTC');
  const [template] = await db.insert(routeTemplates).values({
    tenantId, name: input.name, description: input.description ?? null,
    depotAddress: input.depotAddress ?? null,
    depotLat: input.depotLat?.toString(), depotLng: input.depotLng?.toString(),
    driverId: input.driverId ?? null, vehicleId: input.vehicleId ?? null,
    recurrenceRule: input.recurrenceRule, recurrenceTimezone: input.recurrenceTimezone || 'UTC',
    orderTemplate: input.orderTemplate, isActive: input.isActive, nextGenerateAt,
  }).returning();
  await logActivity({ tenantId, action: 'route_template_created', entityType: 'route_template', entityId: template.id });
  return template;
}

export async function listTemplates(tenantId: string, pagination: PaginationInput) {
  const { page, limit } = pagination;
  const offset = (page - 1) * limit;
  const [items, countResult] = await Promise.all([
    db.select().from(routeTemplates).where(eq(routeTemplates.tenantId, tenantId))
      .limit(limit).offset(offset).orderBy(routeTemplates.createdAt),
    db.select({ count: sql<number>`count(*)` }).from(routeTemplates)
      .where(eq(routeTemplates.tenantId, tenantId)),
  ]);
  const total = Number(countResult[0]?.count ?? 0);
  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getTemplate(tenantId: string, id: string) {
  const [template] = await db.select().from(routeTemplates)
    .where(and(eq(routeTemplates.id, id), eq(routeTemplates.tenantId, tenantId))).limit(1);
  if (!template) throw new NotFoundError('Route template not found');
  return template;
}

export async function updateTemplate(tenantId: string, id: string, input: Partial<CreateRouteTemplateInput>) {
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (input.name !== undefined) updates.name = input.name;
  if (input.description !== undefined) updates.description = input.description;
  if (input.depotAddress !== undefined) updates.depotAddress = input.depotAddress;
  if (input.driverId !== undefined) updates.driverId = input.driverId;
  if (input.vehicleId !== undefined) updates.vehicleId = input.vehicleId;
  if (input.recurrenceRule !== undefined) {
    updates.recurrenceRule = input.recurrenceRule;
    updates.nextGenerateAt = computeNextGenerate(input.recurrenceRule, input.recurrenceTimezone || 'UTC');
  }
  if (input.recurrenceTimezone !== undefined) updates.recurrenceTimezone = input.recurrenceTimezone;
  if (input.orderTemplate !== undefined) updates.orderTemplate = input.orderTemplate;
  if (input.isActive !== undefined) updates.isActive = input.isActive;

  const [template] = await db.update(routeTemplates).set(updates)
    .where(and(eq(routeTemplates.id, id), eq(routeTemplates.tenantId, tenantId))).returning();
  if (!template) throw new NotFoundError('Route template not found');
  return template;
}

export async function deleteTemplate(tenantId: string, id: string) {
  const result = await db.delete(routeTemplates)
    .where(and(eq(routeTemplates.id, id), eq(routeTemplates.tenantId, tenantId)))
    .returning({ id: routeTemplates.id });
  if (result.length === 0) throw new NotFoundError('Route template not found');
}

export async function generateRouteFromTemplate(tenantId: string, templateId: string) {
  const template = await getTemplate(tenantId, templateId);
  const orderTemplateItems = template.orderTemplate as Array<Record<string, unknown>>;

  const result = await db.transaction(async (tx) => {
    // Create orders from template
    const createdOrderIds: string[] = [];
    for (const item of orderTemplateItems) {
      const [order] = await tx.insert(orders).values({
        tenantId,
        recipientName: (item.recipientName as string) || 'Template Order',
        recipientPhone: item.recipientPhone as string ?? undefined,
        recipientEmail: item.recipientEmail as string ?? undefined,
        deliveryAddress: item.deliveryAddress ?? { street: '', city: '', state: '', zip: '' },
        deliveryLat: (item.deliveryAddress as any)?.coords?.lat?.toString() ?? null,
        deliveryLng: (item.deliveryAddress as any)?.coords?.lng?.toString() ?? null,
        packageCount: (item.packageCount as number) || 1,
        priority: (item.priority as any) || 'normal',
        notes: item.notes as string ?? undefined,
      }).returning();
      createdOrderIds.push(order.id);
    }

    // Create route
    const [route] = await tx.insert(routes).values({
      tenantId,
      name: `${template.name} - ${new Date().toLocaleDateString()}`,
      driverId: template.driverId,
      vehicleId: template.vehicleId,
      depotAddress: template.depotAddress,
      depotLat: template.depotLat,
      depotLng: template.depotLng,
      totalStops: createdOrderIds.length,
    }).returning();

    // Assign orders to route
    for (let i = 0; i < createdOrderIds.length; i++) {
      await tx.update(orders).set({
        routeId: route.id, stopSequence: i + 1, status: 'assigned', updatedAt: new Date(),
      }).where(eq(orders.id, createdOrderIds[i]));
    }

    return route;
  });

  // Update template timing
  const nextGenerateAt = computeNextGenerate(template.recurrenceRule, template.recurrenceTimezone);
  await db.update(routeTemplates).set({
    lastGeneratedAt: new Date(), nextGenerateAt, updatedAt: new Date(),
  }).where(eq(routeTemplates.id, templateId));

  return result;
}
