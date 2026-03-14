import { z } from 'zod';

export const locationUpdateSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  speed: z.number().min(0).optional(),
  heading: z.number().int().min(0).max(360).optional(),
  accuracy: z.number().min(0).optional(),
});
export type LocationUpdate = z.infer<typeof locationUpdateSchema>;

export const deliveryEventSchema = z.object({
  routeId: z.string().uuid(),
  orderId: z.string().uuid(),
  status: z.enum(['delivered', 'failed']),
  failureReason: z.string().max(500).optional(),
  signature: z.string().optional(),
  photoUrl: z.string().optional(),
});
export type DeliveryEvent = z.infer<typeof deliveryEventSchema>;

export const routeStatusTransitionSchema = z.object({
  status: z.enum(['planned', 'in_progress', 'completed', 'cancelled']),
});
export type RouteStatusTransition = z.infer<typeof routeStatusTransitionSchema>;
