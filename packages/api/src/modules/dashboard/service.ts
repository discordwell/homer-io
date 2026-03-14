import { eq, and, sql } from 'drizzle-orm';
import { db } from '../../lib/db/index.js';
import { orders } from '../../lib/db/schema/orders.js';
import { routes } from '../../lib/db/schema/routes.js';
import { drivers } from '../../lib/db/schema/drivers.js';
import { vehicles } from '../../lib/db/schema/vehicles.js';
import type { DashboardStats } from '@homer-io/shared';

export async function getDashboardStats(tenantId: string): Promise<DashboardStats> {
  const [
    ordersTodayResult,
    activeRoutesResult,
    activeDriversResult,
    deliveryRateResult,
    totalVehiclesResult,
    recentOrdersResult,
  ] = await Promise.all([
    // Orders created today for tenant
    db.select({ count: sql<number>`count(*)` })
      .from(orders)
      .where(and(
        eq(orders.tenantId, tenantId),
        sql`${orders.createdAt} >= CURRENT_DATE`,
      )),

    // Routes with status 'in_progress' for tenant
    db.select({ count: sql<number>`count(*)` })
      .from(routes)
      .where(and(
        eq(routes.tenantId, tenantId),
        eq(routes.status, 'in_progress'),
      )),

    // Drivers with status 'on_route' or 'available' for tenant
    db.select({ count: sql<number>`count(*)` })
      .from(drivers)
      .where(and(
        eq(drivers.tenantId, tenantId),
        sql`${drivers.status} IN ('on_route', 'available')`,
      )),

    // Delivery rate: delivered / (delivered + failed)
    db.select({
      delivered: sql<number>`count(*) FILTER (WHERE ${orders.status} = 'delivered')`,
      completed: sql<number>`count(*) FILTER (WHERE ${orders.status} IN ('delivered', 'failed'))`,
    })
      .from(orders)
      .where(eq(orders.tenantId, tenantId)),

    // Total active vehicles for tenant
    db.select({ count: sql<number>`count(*)` })
      .from(vehicles)
      .where(and(
        eq(vehicles.tenantId, tenantId),
        eq(vehicles.isActive, true),
      )),

    // Last 10 orders for tenant
    db.select({
      id: orders.id,
      recipientName: orders.recipientName,
      status: orders.status,
      priority: orders.priority,
      packageCount: orders.packageCount,
      createdAt: orders.createdAt,
    })
      .from(orders)
      .where(eq(orders.tenantId, tenantId))
      .orderBy(sql`${orders.createdAt} DESC`)
      .limit(10),
  ]);

  const delivered = Number(deliveryRateResult[0].delivered);
  const completed = Number(deliveryRateResult[0].completed);
  const deliveryRate = completed > 0 ? Math.round((delivered / completed) * 100) : 0;

  return {
    ordersToday: Number(ordersTodayResult[0].count),
    activeRoutes: Number(activeRoutesResult[0].count),
    activeDrivers: Number(activeDriversResult[0].count),
    deliveryRate,
    totalVehicles: Number(totalVehiclesResult[0].count),
    recentOrders: recentOrdersResult.map((o) => ({
      id: o.id,
      recipientName: o.recipientName,
      status: o.status,
      priority: o.priority,
      packageCount: o.packageCount,
      createdAt: o.createdAt.toISOString(),
    })),
  };
}
