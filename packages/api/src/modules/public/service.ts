import { eq, and, desc } from 'drizzle-orm';
import { db } from '../../lib/db/index.js';
import { orders } from '../../lib/db/schema/orders.js';
import { routes } from '../../lib/db/schema/routes.js';
import { drivers } from '../../lib/db/schema/drivers.js';
import { activityLog } from '../../lib/db/schema/activity-log.js';
import { NotFoundError } from '../../lib/errors.js';

export async function getPublicTracking(orderId: string) {
  // Find order by ID — no tenantId filter (public endpoint)
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) throw new NotFoundError('Order not found');

  // Extract first name only for privacy
  const firstName = order.recipientName.split(' ')[0];

  // Get delivery timeline from activity_log — omit metadata for privacy
  const timelineRaw = await db
    .select({
      action: activityLog.action,
      createdAt: activityLog.createdAt,
    })
    .from(activityLog)
    .where(
      and(
        eq(activityLog.entityType, 'order'),
        eq(activityLog.entityId, orderId),
      ),
    )
    .orderBy(desc(activityLog.createdAt));

  const timeline = timelineRaw.map(t => ({
    action: t.action,
    createdAt: t.createdAt.toISOString(),
  }));

  // Get driver location if order is in_transit
  let driverLocation: { lat: number; lng: number } | null = null;
  if (order.status === 'in_transit' && order.routeId) {
    const [route] = await db
      .select({ driverId: routes.driverId })
      .from(routes)
      .where(eq(routes.id, order.routeId))
      .limit(1);

    if (route?.driverId) {
      const [driver] = await db
        .select({
          currentLat: drivers.currentLat,
          currentLng: drivers.currentLng,
        })
        .from(drivers)
        .where(eq(drivers.id, route.driverId))
        .limit(1);

      if (driver?.currentLat && driver?.currentLng) {
        driverLocation = {
          lat: Number(driver.currentLat),
          lng: Number(driver.currentLng),
        };
      }
    }
  }

  // Simple ETA estimate based on status
  let estimatedDelivery: string | null = null;
  if (order.status === 'in_transit') {
    // Estimate 30 minutes from now for in-transit orders
    const eta = new Date(Date.now() + 30 * 60 * 1000);
    estimatedDelivery = eta.toISOString();
  } else if (order.status === 'delivered' && order.completedAt) {
    estimatedDelivery = order.completedAt.toISOString();
  } else if (order.timeWindowEnd) {
    estimatedDelivery = order.timeWindowEnd.toISOString();
  }

  return {
    orderId: order.id,
    status: order.status,
    recipientName: firstName,
    deliveryLat: order.deliveryLat ? Number(order.deliveryLat) : null,
    deliveryLng: order.deliveryLng ? Number(order.deliveryLng) : null,
    estimatedDelivery,
    driverLocation,
    timeline,
    createdAt: order.createdAt.toISOString(),
    completedAt: order.completedAt?.toISOString() ?? null,
  };
}
