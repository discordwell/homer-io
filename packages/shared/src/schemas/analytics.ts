import { z } from 'zod';

export const analyticsQuerySchema = z.object({
  range: z.enum(['7d', '30d', '90d']).default('7d'),
});
export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;

export const driverPerformanceSchema = z.object({
  driverId: z.string().uuid(),
  driverName: z.string(),
  totalDeliveries: z.number(),
  successRate: z.number(),
  avgDeliveryTime: z.number().nullable(),
  totalDistance: z.number().nullable(),
});
export type DriverPerformance = z.infer<typeof driverPerformanceSchema>;

// Enhanced driver performance with sparklines and fleet comparison
export const enhancedDriverPerformanceSchema = driverPerformanceSchema.extend({
  sparkline: z.array(z.number()),        // daily delivery counts for sparkline
  efficiencyScore: z.number(),           // composite 0-100 score
  vsFleetAvg: z.number(),               // delta from fleet avg success rate
});
export type EnhancedDriverPerformance = z.infer<typeof enhancedDriverPerformanceSchema>;

export const routeEfficiencySchema = z.object({
  totalRoutes: z.number(),
  completedRoutes: z.number(),
  avgStopsPerRoute: z.number(),
  avgCompletionRate: z.number(),
  avgDuration: z.number().nullable(),
});
export type RouteEfficiency = z.infer<typeof routeEfficiencySchema>;

// Per-route comparison data for scatter plot + duration bars
export const routeComparisonSchema = z.object({
  routeId: z.string().uuid(),
  routeName: z.string(),
  stops: z.number(),
  durationMinutes: z.number().nullable(),
  plannedDurationMinutes: z.number().nullable(),
  completionRate: z.number(),
  driverName: z.string().nullable(),
});
export type RouteComparison = z.infer<typeof routeComparisonSchema>;

export const enhancedRouteEfficiencySchema = routeEfficiencySchema.extend({
  routes: z.array(routeComparisonSchema),
});
export type EnhancedRouteEfficiency = z.infer<typeof enhancedRouteEfficiencySchema>;

export const trendPointSchema = z.object({
  date: z.string(),
  deliveries: z.number(),
  failedDeliveries: z.number(),
  newOrders: z.number(),
});
export type TrendPoint = z.infer<typeof trendPointSchema>;

// Enhanced trend point with on-time rate
export const enhancedTrendPointSchema = trendPointSchema.extend({
  onTimeRate: z.number().nullable(),
});
export type EnhancedTrendPoint = z.infer<typeof enhancedTrendPointSchema>;

// KPI sparklines and period-over-period deltas
export const kpiSparklinesSchema = z.object({
  deliveries: z.array(z.number()),
  successRate: z.array(z.number()),
  onTimeRate: z.array(z.number()),
  avgDeliveryTime: z.array(z.number()),
  activeDrivers: z.array(z.number()),
  ordersReceived: z.array(z.number()),
});
export type KPISparklines = z.infer<typeof kpiSparklinesSchema>;

export const kpiDeltasSchema = z.object({
  deliveries: z.number(),
  successRate: z.number(),
  onTimeRate: z.number(),
  avgDeliveryTime: z.number(),
  activeDrivers: z.number(),
  ordersReceived: z.number(),
});
export type KPIDeltas = z.infer<typeof kpiDeltasSchema>;

export const analyticsOverviewSchema = z.object({
  totalDeliveries: z.number(),
  successRate: z.number(),
  avgDeliveryTime: z.number().nullable(),
  totalRoutes: z.number(),
  totalDistance: z.number().nullable(),
  ordersReceived: z.number(),
});
export type AnalyticsOverview = z.infer<typeof analyticsOverviewSchema>;

// Enhanced overview with on-time rate, active drivers, sparklines, deltas
export const enhancedOverviewSchema = analyticsOverviewSchema.extend({
  onTimeRate: z.number(),
  activeDriverCount: z.number(),
  totalDriverCount: z.number(),
  sparklines: kpiSparklinesSchema,
  deltas: kpiDeltasSchema,
});
export type EnhancedOverview = z.infer<typeof enhancedOverviewSchema>;

// Delivery heatmap: day-of-week x hour-of-day
export const heatmapCellSchema = z.object({
  dayOfWeek: z.number().min(0).max(6),   // 0=Mon, 6=Sun
  hour: z.number().min(0).max(23),
  count: z.number(),
});
export type HeatmapCell = z.infer<typeof heatmapCellSchema>;

// Auto-generated actionable insights
export const insightSchema = z.object({
  id: z.string(),
  type: z.enum(['anomaly', 'positive', 'warning', 'suggestion']),
  category: z.string(),
  headline: z.string(),
  detail: z.string(),
  impact: z.number(),
  action: z.object({
    type: z.enum(['copilot_query', 'navigate', 'none']),
    payload: z.string().optional(),
  }).optional(),
});
export type Insight = z.infer<typeof insightSchema>;

// Delivery outcomes: failure breakdown + time-window compliance
export const deliveryOutcomesSchema = z.object({
  statusDistribution: z.array(z.object({
    date: z.string(),
    delivered: z.number(),
    failed: z.number(),
    inTransit: z.number(),
    assigned: z.number(),
  })),
  failureCategories: z.array(z.object({
    category: z.string(),
    count: z.number(),
    percentage: z.number(),
  })),
  timeWindowCompliance: z.number(),
  totalWithTimeWindow: z.number(),
  onTimeCount: z.number(),
});
export type DeliveryOutcomes = z.infer<typeof deliveryOutcomesSchema>;
