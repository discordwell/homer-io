import { z } from 'zod';

export const dashboardStatsSchema = z.object({
  ordersToday: z.number(),
  activeRoutes: z.number(),
  activeDrivers: z.number(),
  deliveryRate: z.number(),
  totalVehicles: z.number(),
  recentOrders: z.array(z.object({
    id: z.string(),
    recipientName: z.string(),
    status: z.string(),
    priority: z.string(),
    packageCount: z.number(),
    createdAt: z.string(),
  })),
});
export type DashboardStats = z.infer<typeof dashboardStatsSchema>;
