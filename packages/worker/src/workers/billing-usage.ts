import { Job } from 'bullmq';
import { eq, sql, and, gte } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { orders, routes, drivers } from '../lib/schema.js';

// Minimal subscription/usage tables for worker context
import { pgTable, uuid, varchar, timestamp, integer, pgEnum } from 'drizzle-orm/pg-core';

const subscriptionPlanEnum = pgEnum('subscription_plan', [
  'starter', 'growth', 'enterprise',
]);

const subscriptionStatusEnum = pgEnum('subscription_status', [
  'trialing', 'active', 'past_due', 'canceled', 'unpaid',
]);

const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().unique(),
  plan: subscriptionPlanEnum('plan').default('starter').notNull(),
  status: subscriptionStatusEnum('status').default('trialing').notNull(),
  quantity: integer('quantity').default(1).notNull(),
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

const PLAN_LIMITS: Record<string, { ordersPerDriver: number }> = {
  starter: { ordersPerDriver: 500 },
  growth: { ordersPerDriver: Infinity },
  enterprise: { ordersPerDriver: Infinity },
};

export async function processBillingUsage(job: Job<BillingUsageJobData>) {
  const { tenantId } = job.data;
  const now = new Date();
  const period = now.toISOString().slice(0, 7); // YYYY-MM
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  console.log(`[billing-usage] Processing usage for tenant ${tenantId}, period ${period}`);

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

  // Check plan limits
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.tenantId, tenantId))
    .limit(1);

  if (sub) {
    const limits = PLAN_LIMITS[sub.plan] || PLAN_LIMITS.starter;
    const effectiveDrivers = Math.max(1, driverCount);

    if (limits.ordersPerDriver !== Infinity) {
      const maxOrders = limits.ordersPerDriver * effectiveDrivers;
      const usagePercent = (orderCount / maxOrders) * 100;

      if (usagePercent >= 90) {
        console.warn(
          `[billing-usage] ALERT: Tenant ${tenantId} at ${usagePercent.toFixed(1)}% of order limit ` +
          `(${orderCount}/${maxOrders}) on ${sub.plan} plan`,
        );
      } else if (usagePercent >= 75) {
        console.log(
          `[billing-usage] Warning: Tenant ${tenantId} at ${usagePercent.toFixed(1)}% of order limit`,
        );
      }
    }
  }

  const summary = { tenantId, period, driverCount, orderCount, routeCount };
  console.log(`[billing-usage] Usage summary:`, JSON.stringify(summary));
  return summary;
}
