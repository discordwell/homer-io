import { z } from 'zod';

export const batchOrderStatusSchema = z.object({
  orderIds: z.array(z.string().uuid()).min(1).max(100),
  status: z.enum(['received', 'assigned', 'in_transit', 'delivered', 'failed', 'returned']),
});
export type BatchOrderStatusInput = z.infer<typeof batchOrderStatusSchema>;

export const batchDriverAssignSchema = z.object({
  orderIds: z.array(z.string().uuid()).min(1).max(100),
  routeId: z.string().uuid(),
});
export type BatchDriverAssignInput = z.infer<typeof batchDriverAssignSchema>;
