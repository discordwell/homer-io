import { eq, and, sql, gte } from 'drizzle-orm';
import { db } from '../../lib/db/index.js';
import { orders } from '../../lib/db/schema/orders.js';
import { routes } from '../../lib/db/schema/routes.js';
import { drivers } from '../../lib/db/schema/drivers.js';
import type { AnalyticsOverview, DriverPerformance, RouteEfficiency, TrendPoint } from '@homer-io/shared';

function rangeToDays(range: '7d' | '30d' | '90d'): number {
  switch (range) {
    case '7d': return 7;
    case '30d': return 30;
    case '90d': return 90;
  }
}

function cutoffDate(range: '7d' | '30d' | '90d'): Date {
  const d = new Date();
  d.setDate(d.getDate() - rangeToDays(range));
  return d;
}

export async function getAnalyticsOverview(tenantId: string, range: '7d' | '30d' | '90d'): Promise<AnalyticsOverview> {
  const cutoff = cutoffDate(range);

  const [deliveredResult, failedResult, avgTimeResult, totalRoutesResult, totalDistanceResult, ordersReceivedResult] =
    await Promise.all([
      // Total delivered orders since cutoff
      db.select({ count: sql<number>`count(*)` })
        .from(orders)
        .where(and(
          eq(orders.tenantId, tenantId),
          eq(orders.status, 'delivered'),
          gte(orders.createdAt, cutoff),
        )),

      // Total failed orders since cutoff
      db.select({ count: sql<number>`count(*)` })
        .from(orders)
        .where(and(
          eq(orders.tenantId, tenantId),
          eq(orders.status, 'failed'),
          gte(orders.createdAt, cutoff),
        )),

      // Avg delivery time in minutes for delivered orders
      db.select({
        avg: sql<number>`avg(EXTRACT(EPOCH FROM (${orders.completedAt} - ${orders.createdAt})) / 60)`,
      })
        .from(orders)
        .where(and(
          eq(orders.tenantId, tenantId),
          eq(orders.status, 'delivered'),
          sql`${orders.completedAt} IS NOT NULL`,
          gte(orders.createdAt, cutoff),
        )),

      // Total routes since cutoff
      db.select({ count: sql<number>`count(*)` })
        .from(routes)
        .where(and(
          eq(routes.tenantId, tenantId),
          gte(routes.createdAt, cutoff),
        )),

      // Total distance from routes since cutoff
      db.select({
        total: sql<number>`COALESCE(sum(${routes.totalDistance}::numeric), 0)`,
      })
        .from(routes)
        .where(and(
          eq(routes.tenantId, tenantId),
          gte(routes.createdAt, cutoff),
        )),

      // All orders received since cutoff
      db.select({ count: sql<number>`count(*)` })
        .from(orders)
        .where(and(
          eq(orders.tenantId, tenantId),
          gte(orders.createdAt, cutoff),
        )),
    ]);

  const delivered = Number(deliveredResult[0].count);
  const failed = Number(failedResult[0].count);
  const total = delivered + failed;
  const successRate = total > 0 ? Math.round((delivered / total) * 100 * 10) / 10 : 0;
  const avgTime = avgTimeResult[0].avg != null ? Math.round(Number(avgTimeResult[0].avg)) : null;

  return {
    totalDeliveries: delivered,
    successRate,
    avgDeliveryTime: avgTime,
    totalRoutes: Number(totalRoutesResult[0].count),
    totalDistance: totalDistanceResult[0].total != null ? Number(totalDistanceResult[0].total) : null,
    ordersReceived: Number(ordersReceivedResult[0].count),
  };
}

export async function getDriverPerformance(tenantId: string, range: '7d' | '30d' | '90d'): Promise<DriverPerformance[]> {
  const cutoff = cutoffDate(range);

  // Join orders → routes → drivers to aggregate per driver
  const result = await db.select({
    driverId: drivers.id,
    driverName: drivers.name,
    delivered: sql<number>`count(*) FILTER (WHERE ${orders.status} = 'delivered')`,
    failed: sql<number>`count(*) FILTER (WHERE ${orders.status} = 'failed')`,
    avgTime: sql<number>`avg(EXTRACT(EPOCH FROM (${orders.completedAt} - ${orders.createdAt})) / 60) FILTER (WHERE ${orders.status} = 'delivered' AND ${orders.completedAt} IS NOT NULL)`,
  })
    .from(orders)
    .innerJoin(routes, eq(orders.routeId, routes.id))
    .innerJoin(drivers, eq(routes.driverId, drivers.id))
    .where(and(
      eq(orders.tenantId, tenantId),
      sql`${orders.status} IN ('delivered', 'failed')`,
      gte(orders.createdAt, cutoff),
    ))
    .groupBy(drivers.id, drivers.name)
    .orderBy(sql`count(*) FILTER (WHERE ${orders.status} = 'delivered') DESC`)
    .limit(20);

  // Get total distance per driver from routes
  const distanceResult = await db.select({
    driverId: routes.driverId,
    totalDistance: sql<number>`COALESCE(sum(${routes.totalDistance}::numeric), 0)`,
  })
    .from(routes)
    .where(and(
      eq(routes.tenantId, tenantId),
      sql`${routes.driverId} IS NOT NULL`,
      gte(routes.createdAt, cutoff),
    ))
    .groupBy(routes.driverId);

  const distanceMap = new Map(distanceResult.map(r => [r.driverId, Number(r.totalDistance)]));

  return result.map(r => {
    const delivered = Number(r.delivered);
    const failed = Number(r.failed);
    const total = delivered + failed;
    return {
      driverId: r.driverId,
      driverName: r.driverName,
      totalDeliveries: delivered,
      successRate: total > 0 ? Math.round((delivered / total) * 100 * 10) / 10 : 0,
      avgDeliveryTime: r.avgTime != null ? Math.round(Number(r.avgTime)) : null,
      totalDistance: distanceMap.get(r.driverId) ?? null,
    };
  });
}

export async function getRouteEfficiency(tenantId: string, range: '7d' | '30d' | '90d'): Promise<RouteEfficiency> {
  const cutoff = cutoffDate(range);

  const [statsResult] = await Promise.all([
    db.select({
      totalRoutes: sql<number>`count(*)`,
      completedRoutes: sql<number>`count(*) FILTER (WHERE ${routes.status} = 'completed')`,
      avgStops: sql<number>`COALESCE(avg(${routes.totalStops}), 0)`,
      avgCompletionRate: sql<number>`COALESCE(avg(CASE WHEN ${routes.totalStops} > 0 THEN (${routes.completedStops}::numeric / ${routes.totalStops}::numeric) * 100 ELSE 0 END), 0)`,
      avgDuration: sql<number>`avg(${routes.totalDuration})`,
    })
      .from(routes)
      .where(and(
        eq(routes.tenantId, tenantId),
        gte(routes.createdAt, cutoff),
      )),
  ]);

  const row = statsResult[0];
  return {
    totalRoutes: Number(row.totalRoutes),
    completedRoutes: Number(row.completedRoutes),
    avgStopsPerRoute: Math.round(Number(row.avgStops) * 10) / 10,
    avgCompletionRate: Math.round(Number(row.avgCompletionRate) * 10) / 10,
    avgDuration: row.avgDuration != null ? Math.round(Number(row.avgDuration)) : null,
  };
}

export async function getTrends(tenantId: string, range: '7d' | '30d' | '90d'): Promise<TrendPoint[]> {
  const days = rangeToDays(range);

  // Generate a series of dates and left join with order data
  const result = await db.execute(sql`
    WITH date_series AS (
      SELECT generate_series(
        date_trunc('day', NOW() - INTERVAL '${sql.raw(String(days))} days'),
        date_trunc('day', NOW()),
        '1 day'::interval
      )::date AS day
    )
    SELECT
      ds.day::text AS date,
      COALESCE(count(o.id) FILTER (WHERE o.status = 'delivered'), 0)::int AS deliveries,
      COALESCE(count(o.id) FILTER (WHERE o.status = 'failed'), 0)::int AS "failedDeliveries",
      count(o.id)::int AS "newOrders"
    FROM date_series ds
    LEFT JOIN orders o ON date_trunc('day', o.created_at) = ds.day
      AND o.tenant_id = ${tenantId}
    GROUP BY ds.day
    ORDER BY ds.day ASC
  `);

  return (result as unknown as any[]).map(r => ({
    date: r.date,
    deliveries: Number(r.deliveries),
    failedDeliveries: Number(r.failedDeliveries),
    newOrders: Number(r.newOrders),
  }));
}

export async function exportAnalyticsCsv(tenantId: string, range: '7d' | '30d' | '90d'): Promise<string> {
  const trends = await getTrends(tenantId, range);
  const lines = ['Date,Deliveries,Failed,New Orders'];
  for (const t of trends) {
    lines.push(`${t.date},${t.deliveries},${t.failedDeliveries},${t.newOrders}`);
  }
  return lines.join('\n');
}
