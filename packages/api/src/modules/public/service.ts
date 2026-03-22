import { eq, and, desc } from 'drizzle-orm';
import { db } from '../../lib/db/index.js';
import { orders } from '../../lib/db/schema/orders.js';
import { routes } from '../../lib/db/schema/routes.js';
import { drivers } from '../../lib/db/schema/drivers.js';
import { proofOfDelivery } from '../../lib/db/schema/proof-of-delivery.js';
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

  // ETA estimate based on route calculation or time window fallback
  let estimatedDelivery: string | null = null;
  if (order.status === 'in_transit' && order.routeId) {
    try {
      const { calculateRouteETAs } = await import('../eta/service.js');
      const etas = await calculateRouteETAs(order.routeId, order.tenantId);
      const stopEta = etas.stops.find(s => s.orderId === orderId);
      if (stopEta?.etaTimestamp) {
        estimatedDelivery = stopEta.etaTimestamp;
      } else if (order.timeWindowEnd) {
        estimatedDelivery = order.timeWindowEnd.toISOString();
      }
    } catch {
      if (order.timeWindowEnd) {
        estimatedDelivery = order.timeWindowEnd.toISOString();
      }
    }
  } else if (order.status === 'in_transit') {
    // No route assigned — fall back to time window
    estimatedDelivery = order.timeWindowEnd?.toISOString() ?? null;
  } else if (order.status === 'delivered' && order.completedAt) {
    estimatedDelivery = order.completedAt.toISOString();
  } else if (order.timeWindowEnd) {
    estimatedDelivery = order.timeWindowEnd.toISOString();
  }

  // Gift delivery extras
  let giftMessage: string | null = null;
  let senderFirstName: string | null = null;
  let deliveryPhotoUrl: string | null = null;

  if (order.isGift) {
    giftMessage = order.giftMessage || null;
    senderFirstName = order.senderName ? order.senderName.split(' ')[0] : null;
  }

  // Delivery photo (show after delivered — useful for gift senders)
  if (order.status === 'delivered') {
    try {
      const [pod] = await db.select({ photoUrls: proofOfDelivery.photoUrls })
        .from(proofOfDelivery)
        .where(eq(proofOfDelivery.orderId, orderId))
        .limit(1);
      const urls = (pod?.photoUrls ?? []) as string[];
      deliveryPhotoUrl = urls[0] || null;
    } catch { /* no POD */ }
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
    // Gift delivery extras
    isGift: order.isGift,
    giftMessage,
    senderName: senderFirstName,
    deliveryPhotoUrl,
  };
}
