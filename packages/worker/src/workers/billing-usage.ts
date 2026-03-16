import type { Job } from 'bullmq';
import { eq, sql, and, gte } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { orders, routes, drivers } from '../lib/schema.js';
import { logger } from '../lib/logger.js';

// Minimal subscription/usage tables for worker context
import { pgTable, uuid, varchar, timestamp, integer, boolean, pgEnum } from 'drizzle-orm/pg-core';

const subscriptionPlanEnum = pgEnum('subscription_plan', [
  'free', 'standard', 'growth', 'scale', 'enterprise',
]);

const subscriptionStatusEnum = pgEnum('subscription_status', [
  'trialing', 'active', 'past_due', 'canceled', 'unpaid',
]);

const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().unique(),
  plan: subscriptionPlanEnum('plan').default('free').notNull(),
  status: subscriptionStatusEnum('status').default('trialing').notNull(),
  payAsYouGoEnabled: boolean('pay_as_you_go_enabled').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

const usageRecords = pgTable('usage_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  period: varchar('period', { length: 7 }).notNull(),
  driverCount: integer('driver_count').default(0).notNull(),
  orderCount: integer('order_count').default(0).notNull(),
  routeCount: integer('route_count').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

interface BillingUsageJobData {
  tenantId: string;
}

const PLAN_LIMITS: Record<string, number> = {
  free: 100,
  standard: 1_000,
  growth: 5_000,
  scale: 15_000,
  enterprise: Infinity,
};

const log = logger.child({ worker: 'billing-usage' });

export async function processBillingUsage(job: Job<BillingUsageJobData>) {
  const { tenantId } = job.data;
  const now = new Date();
  const period = now.toISOString().slice(0, 7); // YYYY-MM
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  log.info('Processing usage', { tenantId, period });

  // Count active drivers
  const [driverStats] = await db
    .select({ count: sql<number>`count(*)` })
    .from(drivers)
    .where(eq(drivers.tenantId, tenantId));

  // Count orders this month
  const [orderStats] = await db
    .select({ count: sql<number>`count(*)` })
    .from(orders)
    .where(and(eq(orders.tenantId, tenantId), gte(orders.createdAt, monthStart)));

  // Count routes this month
  const [routeStats] = await db
    .select({ count: sql<number>`count(*)` })
    .from(routes)
    .where(and(eq(routes.tenantId, tenantId), gte(routes.createdAt, monthStart)));

  const driverCount = Number(driverStats.count);
  const orderCount = Number(orderStats.count);
  const routeCount = Number(routeStats.count);

  // Upsert usage record
  await db
    .insert(usageRecords)
    .values({
      tenantId,
      period,
      driverCount,
      orderCount,
      routeCount,
    })
    .onConflictDoUpdate({
      target: [usageRecords.tenantId, usageRecords.period],
      set: {
        driverCount,
        orderCount,
        routeCount,
        updatedAt: new Date(),
      },
    });

  // Check plan order limits
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.tenantId, tenantId))
    .limit(1);

  if (sub) {
    const maxOrders = PLAN_LIMITS[sub.plan] ?? PLAN_LIMITS.free;

    if (maxOrders !== Infinity) {
      const usagePercent = (orderCount / maxOrders) * 100;

      if (usagePercent >= 90) {
        log.warn('Tenant approaching order limit', {
          tenantId,
          usagePercent: usagePercent.toFixed(1),
          orderCount,
          maxOrders,
          plan: sub.plan,
        });
      } else if (usagePercent >= 75) {
        log.info('Tenant usage warning', {
          tenantId,
          usagePercent: usagePercent.toFixed(1),
        });
      }
    }
  }

  const summary = { tenantId, period, driverCount, orderCount, routeCount };
  log.info('Usage summary', summary);
  return summary;
}
