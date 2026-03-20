import { eq, and, sql, gte, lt } from 'drizzle-orm';
import { db } from '../../lib/db/index.js';
import { orders } from '../../lib/db/schema/orders.js';
import { routes } from '../../lib/db/schema/routes.js';
import { drivers } from '../../lib/db/schema/drivers.js';
import type {
  AnalyticsOverview, DriverPerformance, RouteEfficiency, TrendPoint,
  EnhancedOverview, EnhancedDriverPerformance, EnhancedRouteEfficiency,
  EnhancedTrendPoint, HeatmapCell, Insight, DeliveryOutcomes,
} from '@homer-io/shared';

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

// ---------------------------------------------------------------------------
// Enhanced Overview — adds on-time rate, active drivers, sparklines, deltas
// ---------------------------------------------------------------------------

export async function getEnhancedOverview(tenantId: string, range: '7d' | '30d' | '90d'): Promise<EnhancedOverview> {
  const days = rangeToDays(range);
  const cutoff = cutoffDate(range);
  const prevCutoff = new Date(cutoff);
  prevCutoff.setDate(prevCutoff.getDate() - days);

  // Current period overview
  const current = await getAnalyticsOverview(tenantId, range);

  // On-time rate: delivered orders where completedAt <= timeWindowEnd
  const [onTimeResult] = await db.select({
    total: sql<number>`count(*) FILTER (WHERE ${orders.status} = 'delivered')`,
    onTime: sql<number>`count(*) FILTER (WHERE ${orders.status} = 'delivered' AND ${orders.completedAt} <= ${orders.timeWindowEnd})`,
  })
    .from(orders)
    .where(and(
      eq(orders.tenantId, tenantId),
      gte(orders.createdAt, cutoff),
      sql`${orders.timeWindowEnd} IS NOT NULL`,
    ));

  const onTimeTotal = Number(onTimeResult.total);
  const onTimeCount = Number(onTimeResult.onTime);
  const onTimeRate = onTimeTotal > 0 ? Math.round((onTimeCount / onTimeTotal) * 100 * 10) / 10 : 100;

  // Active + total drivers
  const driverCounts = await db.select({
    total: sql<number>`count(*)`,
    active: sql<number>`count(*) FILTER (WHERE ${drivers.status} IN ('available', 'on_route'))`,
  })
    .from(drivers)
    .where(eq(drivers.tenantId, tenantId));

  const totalDriverCount = Number(driverCounts[0].total);
  const activeDriverCount = Number(driverCounts[0].active);

  // Previous period overview for deltas
  const [prevDelivered, prevFailed, prevAvgTime, prevRoutes, prevOrders, prevOnTime] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(orders).where(and(
      eq(orders.tenantId, tenantId), eq(orders.status, 'delivered'),
      gte(orders.createdAt, prevCutoff), lt(orders.createdAt, cutoff),
    )),
    db.select({ count: sql<number>`count(*)` }).from(orders).where(and(
      eq(orders.tenantId, tenantId), eq(orders.status, 'failed'),
      gte(orders.createdAt, prevCutoff), lt(orders.createdAt, cutoff),
    )),
    db.select({ avg: sql<number>`avg(EXTRACT(EPOCH FROM (${orders.completedAt} - ${orders.createdAt})) / 60)` })
      .from(orders).where(and(
        eq(orders.tenantId, tenantId), eq(orders.status, 'delivered'),
        sql`${orders.completedAt} IS NOT NULL`,
        gte(orders.createdAt, prevCutoff), lt(orders.createdAt, cutoff),
      )),
    db.select({ count: sql<number>`count(*)` }).from(routes).where(and(
      eq(routes.tenantId, tenantId),
      gte(routes.createdAt, prevCutoff), lt(routes.createdAt, cutoff),
    )),
    db.select({ count: sql<number>`count(*)` }).from(orders).where(and(
      eq(orders.tenantId, tenantId),
      gte(orders.createdAt, prevCutoff), lt(orders.createdAt, cutoff),
    )),
    db.select({
      total: sql<number>`count(*) FILTER (WHERE ${orders.status} = 'delivered')`,
      onTime: sql<number>`count(*) FILTER (WHERE ${orders.status} = 'delivered' AND ${orders.completedAt} <= ${orders.timeWindowEnd})`,
    }).from(orders).where(and(
      eq(orders.tenantId, tenantId),
      gte(orders.createdAt, prevCutoff), lt(orders.createdAt, cutoff),
      sql`${orders.timeWindowEnd} IS NOT NULL`,
    )),
  ]);

  const pDel = Number(prevDelivered[0].count);
  const pFail = Number(prevFailed[0].count);
  const pTotal = pDel + pFail;
  const pSuccessRate = pTotal > 0 ? Math.round((pDel / pTotal) * 100 * 10) / 10 : 0;
  const pAvgTime = prevAvgTime[0].avg != null ? Math.round(Number(prevAvgTime[0].avg)) : 0;
  const pOnTimeTotal = Number(prevOnTime[0].total);
  const pOnTimeCount = Number(prevOnTime[0].onTime);
  const pOnTimeRate = pOnTimeTotal > 0 ? Math.round((pOnTimeCount / pOnTimeTotal) * 100 * 10) / 10 : 0;

  function delta(curr: number, prev: number): number {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return Math.round(((curr - prev) / prev) * 100 * 10) / 10;
  }

  // Sparklines: daily values for each KPI over the range
  const dailyData = await getEnhancedTrends(tenantId, range);

  // Daily active driver counts (approximation from routes)
  const dailyActiveDrivers = await db.execute(sql`
    WITH date_series AS (
      SELECT generate_series(
        date_trunc('day', NOW() - INTERVAL '${sql.raw(String(days))} days'),
        date_trunc('day', NOW()),
        '1 day'::interval
      )::date AS day
    )
    SELECT ds.day::text AS date,
      COALESCE(count(DISTINCT r.driver_id) FILTER (WHERE r.driver_id IS NOT NULL), 0)::int AS active
    FROM date_series ds
    LEFT JOIN routes r ON date_trunc('day', r.created_at) = ds.day AND r.tenant_id = ${tenantId}
    GROUP BY ds.day ORDER BY ds.day ASC
  `);
  const activeDriverSparkline = (dailyActiveDrivers as unknown as any[]).map(r => Number(r.active));

  return {
    ...current,
    onTimeRate,
    activeDriverCount,
    totalDriverCount,
    sparklines: {
      deliveries: dailyData.map(d => d.deliveries),
      successRate: dailyData.map(d => {
        const total = d.deliveries + d.failedDeliveries;
        return total > 0 ? Math.round((d.deliveries / total) * 100) : 0;
      }),
      onTimeRate: dailyData.map(d => d.onTimeRate ?? 0),
      avgDeliveryTime: dailyData.map(d => d.deliveries), // placeholder — avg time isn't daily in trends
      activeDrivers: activeDriverSparkline,
      ordersReceived: dailyData.map(d => d.newOrders),
    },
    deltas: {
      deliveries: delta(current.totalDeliveries, pDel),
      successRate: Math.round((current.successRate - pSuccessRate) * 10) / 10,
      onTimeRate: Math.round((onTimeRate - pOnTimeRate) * 10) / 10,
      avgDeliveryTime: delta(current.avgDeliveryTime ?? 0, pAvgTime),
      activeDrivers: delta(activeDriverCount, activeDriverCount), // same snapshot
      ordersReceived: delta(current.ordersReceived, Number(prevOrders[0].count)),
    },
  };
}

// ---------------------------------------------------------------------------
// Enhanced Trends — adds on-time rate per day
// ---------------------------------------------------------------------------

export async function getEnhancedTrends(tenantId: string, range: '7d' | '30d' | '90d'): Promise<EnhancedTrendPoint[]> {
  const days = rangeToDays(range);

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
      count(o.id)::int AS "newOrders",
      CASE
        WHEN count(o.id) FILTER (WHERE o.status = 'delivered' AND o.time_window_end IS NOT NULL) > 0
        THEN round((count(o.id) FILTER (WHERE o.status = 'delivered' AND o.completed_at <= o.time_window_end AND o.time_window_end IS NOT NULL)::numeric
              / count(o.id) FILTER (WHERE o.status = 'delivered' AND o.time_window_end IS NOT NULL)::numeric) * 100, 1)
        ELSE NULL
      END AS "onTimeRate"
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
    onTimeRate: r.onTimeRate != null ? Number(r.onTimeRate) : null,
  }));
}

// ---------------------------------------------------------------------------
// Delivery Heatmap — day-of-week × hour-of-day grid
// ---------------------------------------------------------------------------

export async function getHeatmapData(tenantId: string, range: '7d' | '30d' | '90d'): Promise<HeatmapCell[]> {
  const cutoff = cutoffDate(range).toISOString();

  const result = await db.execute(sql`
    SELECT
      (EXTRACT(ISODOW FROM ${orders.completedAt}) - 1)::int AS "dayOfWeek",
      EXTRACT(HOUR FROM ${orders.completedAt})::int AS hour,
      count(*)::int AS count
    FROM ${orders}
    WHERE ${orders.tenantId} = ${tenantId}
      AND ${orders.status} = 'delivered'
      AND ${orders.completedAt} IS NOT NULL
      AND ${orders.createdAt} >= ${cutoff}::timestamptz
    GROUP BY 1, 2
    ORDER BY 1, 2
  `);

  // Fill in missing cells with 0
  const map = new Map<string, number>();
  for (const r of result as unknown as any[]) {
    map.set(`${r.dayOfWeek}-${r.hour}`, Number(r.count));
  }

  const cells: HeatmapCell[] = [];
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      cells.push({ dayOfWeek: day, hour, count: map.get(`${day}-${hour}`) ?? 0 });
    }
  }
  return cells;
}

// ---------------------------------------------------------------------------
// Insights Engine — auto-generated actionable recommendations
// ---------------------------------------------------------------------------

export async function generateInsights(tenantId: string, range: '7d' | '30d' | '90d'): Promise<Insight[]> {
  const days = rangeToDays(range);
  const cutoff = cutoffDate(range);
  const cutoffISO = cutoff.toISOString();
  const prevCutoff = new Date(cutoff);
  prevCutoff.setDate(prevCutoff.getDate() - days);

  const insights: Insight[] = [];
  let insightId = 0;
  const nextInsightId = () => `insight-${++insightId}`;

  // Get base data in parallel
  const [dayOfWeekFailures, hourlyVolume, driverPerf, overview, prevOverview, failureCats] = await Promise.all([
    // Failures by day of week
    db.execute(sql`
      SELECT (EXTRACT(ISODOW FROM created_at) - 1)::int AS dow,
        count(*) FILTER (WHERE status = 'failed')::int AS failed,
        count(*) FILTER (WHERE status IN ('delivered','failed'))::int AS total
      FROM ${orders}
      WHERE tenant_id = ${tenantId} AND created_at >= ${cutoffISO}::timestamptz
        AND status IN ('delivered', 'failed')
      GROUP BY 1 ORDER BY 1
    `),
    // Deliveries by hour
    db.execute(sql`
      SELECT EXTRACT(HOUR FROM completed_at)::int AS hour, count(*)::int AS cnt
      FROM ${orders}
      WHERE tenant_id = ${tenantId} AND status = 'delivered'
        AND completed_at IS NOT NULL AND created_at >= ${cutoffISO}::timestamptz
      GROUP BY 1 ORDER BY cnt DESC
    `),
    getDriverPerformance(tenantId, range),
    getAnalyticsOverview(tenantId, range),
    getAnalyticsOverview(tenantId, range), // We'll compute prev separately below
    // Failure categories
    db.execute(sql`
      SELECT COALESCE(failure_category, 'unknown') AS category, count(*)::int AS cnt
      FROM ${orders}
      WHERE tenant_id = ${tenantId} AND status = 'failed' AND created_at >= ${cutoffISO}::timestamptz
      GROUP BY 1 ORDER BY cnt DESC
    `),
  ]);

  // Previous period for comparison
  const [prevDeliveredR, prevFailedR] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(orders).where(and(
      eq(orders.tenantId, tenantId), eq(orders.status, 'delivered'),
      gte(orders.createdAt, prevCutoff), lt(orders.createdAt, cutoff),
    )),
    db.select({ count: sql<number>`count(*)` }).from(orders).where(and(
      eq(orders.tenantId, tenantId), eq(orders.status, 'failed'),
      gte(orders.createdAt, prevCutoff), lt(orders.createdAt, cutoff),
    )),
  ]);
  const pDel = Number(prevDeliveredR[0].count);
  const pFail = Number(prevFailedR[0].count);
  const pTotal = pDel + pFail;
  const prevSuccessRate = pTotal > 0 ? Math.round((pDel / pTotal) * 100 * 10) / 10 : 0;

  const DOW_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  // 1. Day-of-week failure anomaly
  const dowData = (dayOfWeekFailures as unknown as any[]).map(r => ({
    dow: Number(r.dow), failed: Number(r.failed), total: Number(r.total),
    rate: Number(r.total) > 0 ? Number(r.failed) / Number(r.total) : 0,
  }));
  if (dowData.length > 1) {
    const meanRate = dowData.reduce((s, d) => s + d.rate, 0) / dowData.length;
    for (const d of dowData) {
      if (d.rate > meanRate * 1.5 && d.failed >= 3) {
        insights.push({
          id: nextInsightId(), type: 'warning', category: 'timing',
          headline: `${DOW_NAMES[d.dow]} Failure Spike`,
          detail: `${Math.round(d.rate * 100)}% failure rate on ${DOW_NAMES[d.dow]}s vs ${Math.round(meanRate * 100)}% average. ${d.failed} failures in the period.`,
          impact: Math.min(90, Math.round(d.rate / meanRate * 30)),
          action: { type: 'copilot_query', payload: `Why do we have more failures on ${DOW_NAMES[d.dow]}s? What can we do about it?` },
        });
      }
    }
  }

  // 2. Peak hour detection
  const hourData = (hourlyVolume as unknown as any[]);
  if (hourData.length > 0) {
    const peak = hourData[0];
    const totalVol = hourData.reduce((s: number, h: any) => s + Number(h.cnt), 0);
    const pct = totalVol > 0 ? Math.round((Number(peak.cnt) / totalVol) * 100) : 0;
    if (pct >= 15) {
      const peakHour = Number(peak.hour);
      insights.push({
        id: nextInsightId(), type: 'suggestion', category: 'timing',
        headline: `Peak Hour: ${peakHour}:00–${peakHour + 1}:00`,
        detail: `${pct}% of all deliveries happen in this window (${peak.cnt} deliveries). Ensure full driver availability.`,
        impact: Math.min(70, pct),
        action: { type: 'copilot_query', payload: `What's our staffing like during the ${peakHour}:00-${peakHour + 2}:00 peak window?` },
      });
    }
  }

  // 3. Driver outlier (positive and negative)
  if (driverPerf.length >= 2) {
    const fleetAvg = driverPerf.reduce((s, d) => s + d.successRate, 0) / driverPerf.length;
    for (const d of driverPerf) {
      const diff = d.successRate - fleetAvg;
      if (Math.abs(diff) > 10 && d.totalDeliveries >= 5) {
        if (diff > 0) {
          insights.push({
            id: nextInsightId(), type: 'positive', category: 'driver',
            headline: `${d.driverName} — Star Performer`,
            detail: `${d.successRate}% success rate, ${Math.round(diff)}% above fleet average. Consider assigning high-priority routes.`,
            impact: Math.min(60, Math.round(diff)),
            action: { type: 'copilot_query', payload: `Tell me more about ${d.driverName}'s performance. What makes them stand out?` },
          });
        } else {
          insights.push({
            id: nextInsightId(), type: 'warning', category: 'driver',
            headline: `${d.driverName} — Needs Support`,
            detail: `${d.successRate}% success rate, ${Math.round(Math.abs(diff))}% below fleet average. Review route assignments or provide coaching.`,
            impact: Math.min(80, Math.round(Math.abs(diff))),
            action: { type: 'copilot_query', payload: `What are the common failure patterns for ${d.driverName}? How can we help?` },
          });
        }
      }
    }
  }

  // 4. Failure category concentration
  const failCats = (failureCats as unknown as any[]);
  const totalFailures = failCats.reduce((s: number, c: any) => s + Number(c.cnt), 0);
  if (totalFailures >= 3) {
    for (const cat of failCats) {
      const pct = Math.round((Number(cat.cnt) / totalFailures) * 100);
      if (pct >= 40) {
        const label = String(cat.category).replace(/_/g, ' ');
        insights.push({
          id: nextInsightId(), type: 'warning', category: 'failure',
          headline: `"${label}" Drives ${pct}% of Failures`,
          detail: `${cat.cnt} of ${totalFailures} failures are "${label}". ${label === 'not home' ? 'Consider requiring recipient phone confirmation before dispatch.' : 'Review delivery procedures.'}`,
          impact: Math.min(85, pct),
          action: { type: 'copilot_query', payload: `Why are so many deliveries failing with "${label}"? What can we change?` },
        });
      }
    }
  }

  // 5. Week-over-week regression/improvement
  if (pTotal > 0 && overview.totalDeliveries + (overview.ordersReceived - overview.totalDeliveries) > 0) {
    const diff = overview.successRate - prevSuccessRate;
    if (diff <= -5) {
      insights.push({
        id: nextInsightId(), type: 'anomaly', category: 'performance',
        headline: 'Success Rate Declining',
        detail: `Success rate dropped from ${prevSuccessRate}% to ${overview.successRate}% compared to the previous period.`,
        impact: Math.min(90, Math.round(Math.abs(diff) * 2)),
        action: { type: 'copilot_query', payload: 'Why did our success rate drop? What changed from the previous period?' },
      });
    } else if (diff >= 5) {
      insights.push({
        id: nextInsightId(), type: 'positive', category: 'performance',
        headline: 'Success Rate Improving',
        detail: `Success rate improved from ${prevSuccessRate}% to ${overview.successRate}%, up ${Math.round(diff)}% from the previous period.`,
        impact: Math.min(50, Math.round(diff)),
      });
    }
  }

  // 6. Capacity utilization
  const allDrivers = await db.select({ count: sql<number>`count(*)` })
    .from(drivers).where(eq(drivers.tenantId, tenantId));
  const totalDrivers = Number(allDrivers[0].count);
  if (totalDrivers > 0) {
    const activeResult = await db.execute(sql`
      SELECT count(DISTINCT r.driver_id)::int AS active
      FROM ${routes} r
      WHERE r.tenant_id = ${tenantId} AND r.created_at >= ${cutoffISO}::timestamptz AND r.driver_id IS NOT NULL
    `);
    const activeInPeriod = Number((activeResult as unknown as any[])[0]?.active ?? 0);
    const utilRate = Math.round((activeInPeriod / totalDrivers) * 100);
    if (utilRate < 60 && totalDrivers >= 3) {
      insights.push({
        id: nextInsightId(), type: 'suggestion', category: 'capacity',
        headline: 'Low Driver Utilization',
        detail: `Only ${activeInPeriod} of ${totalDrivers} drivers completed deliveries this period (${utilRate}%). Review driver scheduling.`,
        impact: Math.min(60, 60 - utilRate),
        action: { type: 'copilot_query', payload: 'Which drivers have been inactive and why? Should we adjust scheduling?' },
      });
    }
  }

  // Sort by impact descending, return top 8
  insights.sort((a, b) => b.impact - a.impact);
  return insights.slice(0, 8);
}

// ---------------------------------------------------------------------------
// Delivery Outcomes — failure breakdown + time-window compliance
// ---------------------------------------------------------------------------

export async function getDeliveryOutcomes(tenantId: string, range: '7d' | '30d' | '90d'): Promise<DeliveryOutcomes> {
  const days = rangeToDays(range);

  // Daily status distribution
  const statusResult = await db.execute(sql`
    WITH date_series AS (
      SELECT generate_series(
        date_trunc('day', NOW() - INTERVAL '${sql.raw(String(days))} days'),
        date_trunc('day', NOW()),
        '1 day'::interval
      )::date AS day
    )
    SELECT
      ds.day::text AS date,
      COALESCE(count(o.id) FILTER (WHERE o.status = 'delivered'), 0)::int AS delivered,
      COALESCE(count(o.id) FILTER (WHERE o.status = 'failed'), 0)::int AS failed,
      COALESCE(count(o.id) FILTER (WHERE o.status = 'in_transit'), 0)::int AS "inTransit",
      COALESCE(count(o.id) FILTER (WHERE o.status = 'assigned'), 0)::int AS assigned
    FROM date_series ds
    LEFT JOIN orders o ON date_trunc('day', o.created_at) = ds.day AND o.tenant_id = ${tenantId}
    GROUP BY ds.day ORDER BY ds.day ASC
  `);

  // Failure categories
  const cutoff = cutoffDate(range);
  const cutoffISO = cutoff.toISOString();
  const failCatResult = await db.execute(sql`
    SELECT COALESCE(failure_category, 'unknown') AS category, count(*)::int AS cnt
    FROM ${orders}
    WHERE tenant_id = ${tenantId} AND status = 'failed' AND created_at >= ${cutoffISO}::timestamptz
    GROUP BY 1 ORDER BY cnt DESC
  `);

  const failCats = (failCatResult as unknown as any[]);
  const totalFailures = failCats.reduce((s: number, c: any) => s + Number(c.cnt), 0);

  // Time-window compliance
  const [twResult] = await db.select({
    total: sql<number>`count(*) FILTER (WHERE ${orders.status} = 'delivered' AND ${orders.timeWindowEnd} IS NOT NULL)`,
    onTime: sql<number>`count(*) FILTER (WHERE ${orders.status} = 'delivered' AND ${orders.timeWindowEnd} IS NOT NULL AND ${orders.completedAt} <= ${orders.timeWindowEnd})`,
  })
    .from(orders)
    .where(and(
      eq(orders.tenantId, tenantId),
      gte(orders.createdAt, cutoff),
    ));

  const totalWithTimeWindow = Number(twResult.total);
  const onTimeCount = Number(twResult.onTime);
  const compliance = totalWithTimeWindow > 0 ? Math.round((onTimeCount / totalWithTimeWindow) * 100 * 10) / 10 : 100;

  return {
    statusDistribution: (statusResult as unknown as any[]).map(r => ({
      date: r.date,
      delivered: Number(r.delivered),
      failed: Number(r.failed),
      inTransit: Number(r.inTransit),
      assigned: Number(r.assigned),
    })),
    failureCategories: failCats.map((c: any) => ({
      category: String(c.category).replace(/_/g, ' '),
      count: Number(c.cnt),
      percentage: totalFailures > 0 ? Math.round((Number(c.cnt) / totalFailures) * 100 * 10) / 10 : 0,
    })),
    timeWindowCompliance: compliance,
    totalWithTimeWindow,
    onTimeCount,
  };
}

// ---------------------------------------------------------------------------
// Enhanced Driver Performance — sparklines + efficiency score + fleet comparison
// ---------------------------------------------------------------------------

export async function getEnhancedDriverPerformance(tenantId: string, range: '7d' | '30d' | '90d'): Promise<EnhancedDriverPerformance[]> {
  const days = rangeToDays(range);
  const basePerf = await getDriverPerformance(tenantId, range);
  if (basePerf.length === 0) return [];

  const fleetAvgSuccess = basePerf.reduce((s, d) => s + d.successRate, 0) / basePerf.length;

  // Per-driver daily delivery counts for sparklines
  const sparklineResult = await db.execute(sql`
    WITH date_series AS (
      SELECT generate_series(
        date_trunc('day', NOW() - INTERVAL '${sql.raw(String(days))} days'),
        date_trunc('day', NOW()),
        '1 day'::interval
      )::date AS day
    )
    SELECT r.driver_id AS "driverId", ds.day::text AS date,
      COALESCE(count(o.id) FILTER (WHERE o.status = 'delivered'), 0)::int AS cnt
    FROM date_series ds
    CROSS JOIN (SELECT DISTINCT driver_id FROM ${routes} WHERE tenant_id = ${tenantId} AND driver_id IS NOT NULL) r
    LEFT JOIN orders o ON date_trunc('day', o.created_at) = ds.day
      AND o.tenant_id = ${tenantId}
      AND o.route_id IN (SELECT id FROM ${routes} WHERE driver_id = r.driver_id)
    GROUP BY r.driver_id, ds.day ORDER BY r.driver_id, ds.day
  `);

  // Group sparkline data by driver
  const sparklineMap = new Map<string, number[]>();
  for (const r of sparklineResult as unknown as any[]) {
    const arr = sparklineMap.get(r.driverId) ?? [];
    arr.push(Number(r.cnt));
    sparklineMap.set(r.driverId, arr);
  }

  return basePerf.map(d => {
    // Composite efficiency score: 60% success rate + 25% speed (inverse of avg time) + 15% volume
    const speedScore = d.avgDeliveryTime != null ? Math.max(0, 100 - d.avgDeliveryTime) : 50;
    const volumeScore = Math.min(100, (d.totalDeliveries / Math.max(1, basePerf[0].totalDeliveries)) * 100);
    const efficiencyScore = Math.round(d.successRate * 0.6 + speedScore * 0.25 + volumeScore * 0.15);

    return {
      ...d,
      sparkline: sparklineMap.get(d.driverId) ?? [],
      efficiencyScore: Math.min(100, efficiencyScore),
      vsFleetAvg: Math.round((d.successRate - fleetAvgSuccess) * 10) / 10,
    };
  });
}

// ---------------------------------------------------------------------------
// Enhanced Route Efficiency — per-route comparison data
// ---------------------------------------------------------------------------

export async function getEnhancedRouteEfficiency(tenantId: string, range: '7d' | '30d' | '90d'): Promise<EnhancedRouteEfficiency> {
  const cutoff = cutoffDate(range);
  const base = await getRouteEfficiency(tenantId, range);

  const routeData = await db.select({
    routeId: routes.id,
    routeName: routes.name,
    stops: routes.totalStops,
    completedStops: routes.completedStops,
    totalDuration: routes.totalDuration,
    driverId: routes.driverId,
    plannedStartAt: routes.plannedStartAt,
    actualEndAt: routes.actualEndAt,
    plannedEndAt: routes.plannedEndAt,
  })
    .from(routes)
    .where(and(
      eq(routes.tenantId, tenantId),
      gte(routes.createdAt, cutoff),
    ))
    .orderBy(sql`${routes.createdAt} DESC`)
    .limit(50);

  // Get driver names
  const driverIds = [...new Set(routeData.filter(r => r.driverId).map(r => r.driverId!))];
  const driverNameMap = new Map<string, string>();
  if (driverIds.length > 0) {
    const driverRows = await db.select({ id: drivers.id, name: drivers.name })
      .from(drivers)
      .where(sql`${drivers.id} IN ${driverIds}`);
    for (const d of driverRows) driverNameMap.set(d.id, d.name);
  }

  return {
    ...base,
    routes: routeData.map(r => {
      const stops = Number(r.stops ?? 0);
      const completed = Number(r.completedStops ?? 0);
      return {
        routeId: r.routeId,
        routeName: r.routeName,
        stops,
        durationMinutes: r.totalDuration != null ? Math.round(Number(r.totalDuration)) : null,
        plannedDurationMinutes: r.plannedStartAt && r.plannedEndAt
          ? Math.round((r.plannedEndAt.getTime() - r.plannedStartAt.getTime()) / 60000)
          : null,
        completionRate: stops > 0 ? Math.round((completed / stops) * 100) : 0,
        driverName: r.driverId ? (driverNameMap.get(r.driverId) ?? null) : null,
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// Period Comparison — for copilot "compare this week to last week"
// ---------------------------------------------------------------------------

export async function comparePeriods(
  tenantId: string,
  range: '7d' | '30d' | '90d',
): Promise<{ current: AnalyticsOverview; previous: AnalyticsOverview; deltas: Record<string, number> }> {
  const days = rangeToDays(range);
  const cutoff = cutoffDate(range);
  const prevCutoff = new Date(cutoff);
  prevCutoff.setDate(prevCutoff.getDate() - days);

  const current = await getAnalyticsOverview(tenantId, range);

  // Previous period
  const [pDel, pFail, pAvg, pRoutes, pDist, pOrders] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(orders).where(and(
      eq(orders.tenantId, tenantId), eq(orders.status, 'delivered'),
      gte(orders.createdAt, prevCutoff), lt(orders.createdAt, cutoff),
    )),
    db.select({ count: sql<number>`count(*)` }).from(orders).where(and(
      eq(orders.tenantId, tenantId), eq(orders.status, 'failed'),
      gte(orders.createdAt, prevCutoff), lt(orders.createdAt, cutoff),
    )),
    db.select({ avg: sql<number>`avg(EXTRACT(EPOCH FROM (${orders.completedAt} - ${orders.createdAt})) / 60)` })
      .from(orders).where(and(
        eq(orders.tenantId, tenantId), eq(orders.status, 'delivered'),
        sql`${orders.completedAt} IS NOT NULL`,
        gte(orders.createdAt, prevCutoff), lt(orders.createdAt, cutoff),
      )),
    db.select({ count: sql<number>`count(*)` }).from(routes).where(and(
      eq(routes.tenantId, tenantId),
      gte(routes.createdAt, prevCutoff), lt(routes.createdAt, cutoff),
    )),
    db.select({ total: sql<number>`COALESCE(sum(${routes.totalDistance}::numeric), 0)` })
      .from(routes).where(and(
        eq(routes.tenantId, tenantId),
        gte(routes.createdAt, prevCutoff), lt(routes.createdAt, cutoff),
      )),
    db.select({ count: sql<number>`count(*)` }).from(orders).where(and(
      eq(orders.tenantId, tenantId),
      gte(orders.createdAt, prevCutoff), lt(orders.createdAt, cutoff),
    )),
  ]);

  const prevDel = Number(pDel[0].count);
  const prevFail = Number(pFail[0].count);
  const prevTotal = prevDel + prevFail;
  const previous: AnalyticsOverview = {
    totalDeliveries: prevDel,
    successRate: prevTotal > 0 ? Math.round((prevDel / prevTotal) * 100 * 10) / 10 : 0,
    avgDeliveryTime: pAvg[0].avg != null ? Math.round(Number(pAvg[0].avg)) : null,
    totalRoutes: Number(pRoutes[0].count),
    totalDistance: pDist[0].total != null ? Number(pDist[0].total) : null,
    ordersReceived: Number(pOrders[0].count),
  };

  function pctChange(curr: number, prev: number): number {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return Math.round(((curr - prev) / prev) * 100 * 10) / 10;
  }

  return {
    current,
    previous,
    deltas: {
      deliveries: pctChange(current.totalDeliveries, previous.totalDeliveries),
      successRate: Math.round((current.successRate - previous.successRate) * 10) / 10,
      avgDeliveryTime: pctChange(current.avgDeliveryTime ?? 0, previous.avgDeliveryTime ?? 0),
      routes: pctChange(current.totalRoutes, previous.totalRoutes),
      ordersReceived: pctChange(current.ordersReceived, previous.ordersReceived),
    },
  };
}
