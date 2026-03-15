import { eq, and, ne, asc } from 'drizzle-orm';
import Redis from 'ioredis';
import { db } from '../../lib/db/index.js';
import { routes } from '../../lib/db/schema/routes.js';
import { orders } from '../../lib/db/schema/orders.js';
import { haversineDistance } from '../../lib/geo.js';
import { broadcastToTenant } from '../../lib/ws/index.js';
import { enqueueCustomerNotification } from '../customer-notifications/service.js';
import { config } from '../../config.js';

const GEOFENCE_RADIUS_KM = 0.1; // 100 meters
const GEOFENCE_TTL_SECONDS = 86400; // 24 hours

let redis: Redis | null = null;

function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(config.redis.url);
  }
  return redis;
}

/**
 * Check if driver is within 100m of any uncompleted stop on their active route.
 * Triggers customer notification and Socket.IO broadcast on first entry.
 * Uses Redis pipeline for batch deduplication checks (avoids N+1 round-trips).
 */
export async function checkGeofences(
  tenantId: string,
  driverId: string,
  lat: number,
  lng: number,
): Promise<void> {
  // Find active route for driver (status = 'in_progress')
  const [activeRoute] = await db
    .select({ id: routes.id })
    .from(routes)
    .where(
      and(
        eq(routes.tenantId, tenantId),
        eq(routes.driverId, driverId),
        eq(routes.status, 'in_progress'),
      ),
    )
    .limit(1);

  if (!activeRoute) return;

  const routeId = activeRoute.id;

  // Load uncompleted orders for that route with delivery coordinates
  const uncompletedOrders = await db
    .select({
      id: orders.id,
      deliveryLat: orders.deliveryLat,
      deliveryLng: orders.deliveryLng,
    })
    .from(orders)
    .where(
      and(
        eq(orders.routeId, routeId),
        eq(orders.tenantId, tenantId),
        ne(orders.status, 'delivered'),
        ne(orders.status, 'failed'),
        ne(orders.status, 'returned'),
      ),
    )
    .orderBy(asc(orders.stopSequence));

  // Filter to orders within geofence radius
  const nearbyOrders: Array<{ id: string; distance: number }> = [];
  for (const order of uncompletedOrders) {
    if (!order.deliveryLat || !order.deliveryLng) continue;
    const distance = haversineDistance(lat, lng, Number(order.deliveryLat), Number(order.deliveryLng));
    if (distance <= GEOFENCE_RADIUS_KM) {
      nearbyOrders.push({ id: order.id, distance });
    }
  }

  if (nearbyOrders.length === 0) return;

  const client = getRedis();

  // Pipeline: batch EXISTS check for all nearby orders in a single round-trip
  const redisKeys = nearbyOrders.map(o => `geofence:triggered:${routeId}:${o.id}`);
  const pipeline = client.pipeline();
  for (const key of redisKeys) {
    pipeline.exists(key);
  }
  const existsResults = await pipeline.exec();

  // Process only orders not yet triggered
  for (let i = 0; i < nearbyOrders.length; i++) {
    const alreadyTriggered = existsResults?.[i]?.[1] === 1;
    if (alreadyTriggered) continue;

    const order = nearbyOrders[i];

    // Mark as triggered with 24h TTL
    await client.set(redisKeys[i], '1', 'EX', GEOFENCE_TTL_SECONDS);

    // Trigger customer notification
    await enqueueCustomerNotification(tenantId, order.id, 'delivery_approaching');

    // Broadcast via Socket.IO
    broadcastToTenant(tenantId, 'delivery:approaching', {
      orderId: order.id,
      driverId,
      routeId,
    });

    console.log(
      `[geofencing] Driver ${driverId} within ${Math.round(order.distance * 1000)}m of order ${order.id}`,
    );
  }
}
