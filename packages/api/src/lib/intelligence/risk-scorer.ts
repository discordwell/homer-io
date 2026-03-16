import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { addressIntelligence } from '../db/schema/address-intelligence.js';
import { deliveryMetrics } from '../db/schema/delivery-metrics.js';
import { orders } from '../db/schema/orders.js';
import { hashAddress } from '../address.js';

export interface RiskScore {
  orderId: string;
  score: number;
  factors: RiskFactor[];
}

interface RiskFactor {
  name: string;
  points: number;
  detail: string;
}

interface AddressComponents {
  street: string;
  city: string;
  state: string;
  zip: string;
  country?: string;
}

/**
 * Score delivery risk 0-100 for a single order.
 */
export async function scoreOrderRisk(
  tenantId: string,
  orderId: string,
): Promise<RiskScore> {
  const [order] = await db.select().from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.tenantId, tenantId)))
    .limit(1);

  if (!order) return { orderId, score: 0, factors: [] };

  const factors: RiskFactor[] = [];
  const deliveryAddr = order.deliveryAddress as AddressComponents | null;

  if (deliveryAddr?.street) {
    const addrHash = hashAddress(deliveryAddr);
    const [intel] = await db.select().from(addressIntelligence)
      .where(and(
        eq(addressIntelligence.tenantId, tenantId),
        eq(addressIntelligence.addressHash, addrHash),
      ))
      .limit(1);

    if (intel) {
      // High failure rate at this address
      if (intel.totalDeliveries > 0) {
        const failureRate = intel.failedDeliveries / intel.totalDeliveries;
        if (failureRate > 0.3) {
          factors.push({
            name: 'high_failure_rate',
            points: 30,
            detail: `${Math.round(failureRate * 100)}% failure rate (${intel.failedDeliveries}/${intel.totalDeliveries})`,
          });
        }
      }

      // Bad hour for this address
      if (order.timeWindowStart) {
        const plannedHour = new Date(order.timeWindowStart).getUTCHours();
        const hourlyPatterns = intel.bestDeliveryHours as Array<{ hour: number; success_rate: number; sample_size: number }>;
        const hourData = hourlyPatterns?.find(h => h.hour === plannedHour);
        if (hourData && hourData.sample_size >= 3 && hourData.success_rate < 0.5) {
          factors.push({
            name: 'bad_delivery_hour',
            points: 20,
            detail: `${Math.round(hourData.success_rate * 100)}% success at hour ${plannedHour} (n=${hourData.sample_size})`,
          });
        }
      }
    } else {
      // No previous data — uncertainty risk
      factors.push({
        name: 'no_history',
        points: 5,
        detail: 'First delivery to this address',
      });
    }
  }

  // Tight time window
  if (order.timeWindowStart && order.timeWindowEnd) {
    const windowMinutes = (new Date(order.timeWindowEnd).getTime() - new Date(order.timeWindowStart).getTime()) / 60000;
    if (windowMinutes > 0 && windowMinutes < 60) {
      factors.push({
        name: 'tight_time_window',
        points: 10,
        detail: `${Math.round(windowMinutes)} minute window`,
      });
    }
  }

  const score = Math.min(100, factors.reduce((sum, f) => sum + f.points, 0));
  return { orderId, score, factors };
}

/**
 * Score risk for all stops on a route.
 */
export async function scoreRouteRisk(
  tenantId: string,
  routeId: string,
): Promise<RiskScore[]> {
  const routeOrders = await db.select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.routeId, routeId), eq(orders.tenantId, tenantId)));

  const scores = await Promise.all(
    routeOrders.map(o => scoreOrderRisk(tenantId, o.id)),
  );

  return scores.sort((a, b) => b.score - a.score);
}

/**
 * Score risk for an order including driver history at the address.
 */
export async function scoreOrderRiskWithDriver(
  tenantId: string,
  orderId: string,
  driverId: string,
): Promise<RiskScore> {
  const base = await scoreOrderRisk(tenantId, orderId);

  const [order] = await db.select().from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.tenantId, tenantId)))
    .limit(1);

  if (!order) return base;

  const deliveryAddr = order.deliveryAddress as AddressComponents | null;
  if (!deliveryAddr?.street) return base;

  const addrHash = hashAddress(deliveryAddr);
  const [intel] = await db.select().from(addressIntelligence)
    .where(and(
      eq(addressIntelligence.tenantId, tenantId),
      eq(addressIntelligence.addressHash, addrHash),
    ))
    .limit(1);

  if (!intel) return base;

  // Check if this specific driver has failed at this address
  const driverFailures = await db.select()
    .from(deliveryMetrics)
    .where(and(
      eq(deliveryMetrics.addressIntelligenceId, intel.id),
      eq(deliveryMetrics.tenantId, tenantId),
    ));

  // We can only correlate via route → driver, so check route-level failures
  // This is a simplified check; a future version could join through routes
  if (driverFailures.some(m => m.deliveryStatus === 'failed')) {
    base.factors.push({
      name: 'driver_failed_here',
      points: 15,
      detail: 'A driver has previously failed at this address',
    });
    base.score = Math.min(100, base.score + 15);
  }

  return base;
}
