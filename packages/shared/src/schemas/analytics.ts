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

export const routeEfficiencySchema = z.object({
  totalRoutes: z.number(),
  completedRoutes: z.number(),
  avgStopsPerRoute: z.number(),
  avgCompletionRate: z.number(),
  avgDuration: z.number().nullable(),
});
export type RouteEfficiency = z.infer<typeof routeEfficiencySchema>;

export const trendPointSchema = z.object({
  date: z.string(),
  deliveries: z.number(),
  failedDeliveries: z.number(),
  newOrders: z.number(),
});
export type TrendPoint = z.infer<typeof trendPointSchema>;

export const analyticsOverviewSchema = z.object({
  totalDeliveries: z.number(),
  successRate: z.number(),
  avgDeliveryTime: z.number().nullable(),
  totalRoutes: z.number(),
  totalDistance: z.number().nullable(),
  ordersReceived: z.number(),
});
export type AnalyticsOverview = z.infer<typeof analyticsOverviewSchema>;
