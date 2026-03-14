import { Job } from 'bullmq';
import { eq, sql, and, gte } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { orders, routes, drivers } from '../lib/schema.js';

interface AnalyticsJobData {
  tenantId: string;
}

export async function processAnalytics(job: Job<AnalyticsJobData>) {
  const { tenantId } = job.data;
  console.log(`[analytics] Processing analytics aggregation for tenant ${tenantId}`);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Query daily order stats
  const [orderStats] = await db
    .select({
      total: sql<number>`count(*)`,
      delivered: sql<number>`count(*) filter (where ${orders.status} = 'delivered')`,
      failed: sql<number>`count(*) filter (where ${orders.status} = 'failed')`,
      inTransit: sql<number>`count(*) filter (where ${orders.status} = 'in_transit')`,
      received: sql<number>`count(*) filter (where ${orders.status} = 'received')`,
    })
    .from(orders)
    .where(and(eq(orders.tenantId, tenantId), gte(orders.createdAt, today)));

  // Query route stats
  const [routeStats] = await db
    .select({
      total: sql<number>`count(*)`,
      completed: sql<number>`count(*) filter (where ${routes.status} = 'completed')`,
      inProgress: sql<number>`count(*) filter (where ${routes.status} = 'in_progress')`,
    })
    .from(routes)
    .where(and(eq(routes.tenantId, tenantId), gte(routes.createdAt, today)));

  // Query active driver count
  const [driverStats] = await db
    .select({
      total: sql<number>`count(*)`,
      active: sql<number>`count(*) filter (where ${drivers.status} != 'offline')`,
    })
    .from(drivers)
    .where(eq(drivers.tenantId, tenantId));

  const summary = {
    date: today.toISOString().split('T')[0],
    tenantId,
    orders: orderStats,
    routes: routeStats,
    drivers: driverStats,
  };

  console.log(`[analytics] Daily summary for tenant ${tenantId}:`, JSON.stringify(summary, null, 2));

  return summary;
}
