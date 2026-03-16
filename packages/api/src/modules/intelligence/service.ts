import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../../lib/db/index.js';
import { addressIntelligence } from '../../lib/db/schema/address-intelligence.js';
import { deliveryMetrics } from '../../lib/db/schema/delivery-metrics.js';
import { orders } from '../../lib/db/schema/orders.js';
import { NotFoundError } from '../../lib/errors.js';
import { scoreRouteRisk } from '../../lib/intelligence/risk-scorer.js';

/**
 * Get address intelligence by hash.
 */
export async function getAddressIntelligence(tenantId: string, addressHash: string) {
  const [intel] = await db.select()
    .from(addressIntelligence)
    .where(and(
      eq(addressIntelligence.tenantId, tenantId),
      eq(addressIntelligence.addressHash, addressHash),
    ))
    .limit(1);

  if (!intel) throw new NotFoundError('No intelligence for this address');

  // Get recent delivery metrics for this address
  const recentMetrics = await db.select({
    deliveryStatus: deliveryMetrics.deliveryStatus,
    failureCategory: deliveryMetrics.failureCategory,
    serviceTimeSeconds: deliveryMetrics.serviceTimeSeconds,
    completedAt: deliveryMetrics.completedAt,
    etaErrorMinutes: deliveryMetrics.etaErrorMinutes,
  })
    .from(deliveryMetrics)
    .where(and(
      eq(deliveryMetrics.addressIntelligenceId, intel.id),
      eq(deliveryMetrics.tenantId, tenantId),
    ))
    .orderBy(desc(deliveryMetrics.completedAt))
    .limit(20);

  return {
    ...intel,
    recentMetrics,
  };
}

/**
 * Get risk scores for all stops on a route.
 */
export async function getRouteRisk(tenantId: string, routeId: string) {
  return scoreRouteRisk(tenantId, routeId);
}

/**
 * Get dashboard-level intelligence insights.
 */
export async function getInsights(tenantId: string) {
  // Top failure addresses (most failed deliveries)
  const topFailureAddresses = await db.select({
    addressHash: addressIntelligence.addressHash,
    addressNormalized: addressIntelligence.addressNormalized,
    totalDeliveries: addressIntelligence.totalDeliveries,
    failedDeliveries: addressIntelligence.failedDeliveries,
    successfulDeliveries: addressIntelligence.successfulDeliveries,
    commonFailureReasons: addressIntelligence.commonFailureReasons,
  })
    .from(addressIntelligence)
    .where(and(
      eq(addressIntelligence.tenantId, tenantId),
      sql`${addressIntelligence.failedDeliveries} > 0`,
    ))
    .orderBy(desc(addressIntelligence.failedDeliveries))
    .limit(10);

  // Addresses with best learned service times (most data)
  const topLearnedAddresses = await db.select({
    addressHash: addressIntelligence.addressHash,
    addressNormalized: addressIntelligence.addressNormalized,
    avgServiceTimeSeconds: addressIntelligence.avgServiceTimeSeconds,
    totalDeliveries: addressIntelligence.totalDeliveries,
  })
    .from(addressIntelligence)
    .where(and(
      eq(addressIntelligence.tenantId, tenantId),
      sql`${addressIntelligence.totalDeliveries} >= 3`,
    ))
    .orderBy(desc(addressIntelligence.totalDeliveries))
    .limit(10);

  // Overall learning stats
  const [stats] = await db.select({
    totalAddresses: sql<number>`count(*)`,
    totalDeliveries: sql<number>`coalesce(sum(${addressIntelligence.totalDeliveries}), 0)`,
    avgFailureRate: sql<number>`case when sum(${addressIntelligence.totalDeliveries}) > 0
      then sum(${addressIntelligence.failedDeliveries})::float / sum(${addressIntelligence.totalDeliveries})
      else 0 end`,
  })
    .from(addressIntelligence)
    .where(eq(addressIntelligence.tenantId, tenantId));

  // Recent metrics aggregate (last 7 days)
  const [recentStats] = await db.select({
    deliveriesTracked: sql<number>`count(*)`,
    avgServiceTime: sql<number>`avg(${deliveryMetrics.serviceTimeSeconds})`,
    avgEtaError: sql<number>`avg(abs(${deliveryMetrics.etaErrorMinutes}::float))`,
  })
    .from(deliveryMetrics)
    .where(and(
      eq(deliveryMetrics.tenantId, tenantId),
      sql`${deliveryMetrics.completedAt} >= now() - interval '7 days'`,
    ));

  return {
    summary: {
      totalAddressesLearned: Number(stats?.totalAddresses ?? 0),
      totalDeliveriesTracked: Number(stats?.totalDeliveries ?? 0),
      overallFailureRate: Number(stats?.avgFailureRate ?? 0),
    },
    last7Days: {
      deliveriesTracked: Number(recentStats?.deliveriesTracked ?? 0),
      avgServiceTimeSeconds: recentStats?.avgServiceTime ? Math.round(Number(recentStats.avgServiceTime)) : null,
      avgEtaErrorMinutes: recentStats?.avgEtaError ? Math.round(Number(recentStats.avgEtaError) * 10) / 10 : null,
    },
    topFailureAddresses,
    topLearnedAddresses,
  };
}
