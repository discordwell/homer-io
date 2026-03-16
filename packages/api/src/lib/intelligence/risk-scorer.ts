import { eq, and, inArray } from 'drizzle-orm';
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

      // Check if any delivery has previously failed at this address
      const [failedMetric] = await db.select({ id: deliveryMetrics.id })
        .from(deliveryMetrics)
        .where(and(
          eq(deliveryMetrics.addressIntelligenceId, intel.id),
          eq(deliveryMetrics.tenantId, tenantId),
          eq(deliveryMetrics.deliveryStatus, 'failed'),
        ))
        .limit(1);

      if (failedMetric) {
        factors.push({
          name: 'previous_failure_at_address',
          points: 15,
          detail: 'A previous delivery has failed at this address',
        });
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
 * Batch-loads orders and address intelligence to avoid N+1 queries.
 */
export async function scoreRouteRisk(
  tenantId: string,
  routeId: string,
): Promise<RiskScore[]> {
  // Batch load all orders on the route
  const routeOrders = await db.select().from(orders)
    .where(and(eq(orders.routeId, routeId), eq(orders.tenantId, tenantId)));

  if (routeOrders.length === 0) return [];

  // Compute all address hashes and batch-load intelligence
  const orderHashMap = new Map<string, { order: typeof routeOrders[0]; hash: string }>();
  const allHashes: string[] = [];

  for (const order of routeOrders) {
    const deliveryAddr = order.deliveryAddress as AddressComponents | null;
    if (deliveryAddr?.street) {
      const hash = hashAddress(deliveryAddr);
      orderHashMap.set(order.id, { order, hash });
      allHashes.push(hash);
    }
  }

  // Batch-load address intelligence for all unique hashes
  const uniqueHashes = [...new Set(allHashes)];
  const intelRecords = uniqueHashes.length > 0
    ? await db.select().from(addressIntelligence)
        .where(and(
          eq(addressIntelligence.tenantId, tenantId),
          inArray(addressIntelligence.addressHash, uniqueHashes),
        ))
    : [];

  const intelByHash = new Map(intelRecords.map(i => [i.addressHash, i]));

  // Batch-load failure metrics for all intelligence IDs
  const intelIds = intelRecords.map(i => i.id);
  const failedMetrics = intelIds.length > 0
    ? await db.select({ addressIntelligenceId: deliveryMetrics.addressIntelligenceId })
        .from(deliveryMetrics)
        .where(and(
          eq(deliveryMetrics.tenantId, tenantId),
          inArray(deliveryMetrics.addressIntelligenceId, intelIds),
          eq(deliveryMetrics.deliveryStatus, 'failed'),
        ))
    : [];

  const intelIdsWithFailures = new Set(failedMetrics.map(m => m.addressIntelligenceId));

  // Score each order using pre-loaded data
  const scores: RiskScore[] = routeOrders.map(order => {
    const factors: RiskFactor[] = [];
    const mapping = orderHashMap.get(order.id);

    if (mapping) {
      const intel = intelByHash.get(mapping.hash);

      if (intel) {
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

        if (intelIdsWithFailures.has(intel.id)) {
          factors.push({
            name: 'previous_failure_at_address',
            points: 15,
            detail: 'A previous delivery has failed at this address',
          });
        }
      } else {
        factors.push({ name: 'no_history', points: 5, detail: 'First delivery to this address' });
      }
    }

    if (order.timeWindowStart && order.timeWindowEnd) {
      const windowMinutes = (new Date(order.timeWindowEnd).getTime() - new Date(order.timeWindowStart).getTime()) / 60000;
      if (windowMinutes > 0 && windowMinutes < 60) {
        factors.push({ name: 'tight_time_window', points: 10, detail: `${Math.round(windowMinutes)} minute window` });
      }
    }

    const score = Math.min(100, factors.reduce((sum, f) => sum + f.points, 0));
    return { orderId: order.id, score, factors };
  });

  return scores.sort((a, b) => b.score - a.score);
}
