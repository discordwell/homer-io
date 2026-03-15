import { z } from 'zod';

export const autoDispatchRequestSchema = z.object({
  date: z.string().datetime().optional(),
  maxOrdersPerRoute: z.number().int().min(1).max(200).default(50),
  prioritizeUrgent: z.boolean().default(true),
});
export type AutoDispatchRequest = z.infer<typeof autoDispatchRequestSchema>;

export const autoDispatchRouteSchema = z.object({
  driverId: z.string().uuid(),
  driverName: z.string(),
  orderIds: z.array(z.string().uuid()),
  estimatedDistance: z.number().optional(),
  reasoning: z.string(),
});
export type AutoDispatchRoute = z.infer<typeof autoDispatchRouteSchema>;

export const autoDispatchResponseSchema = z.object({
  routes: z.array(autoDispatchRouteSchema),
  unassignedOrderIds: z.array(z.string().uuid()),
  totalOrders: z.number(),
  totalDrivers: z.number(),
});
export type AutoDispatchResponse = z.infer<typeof autoDispatchResponseSchema>;

export const confirmDispatchSchema = z.object({
  routeIds: z.array(z.string().uuid()).min(1),
});
export type ConfirmDispatchInput = z.infer<typeof confirmDispatchSchema>;
