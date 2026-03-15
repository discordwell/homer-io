import { z } from 'zod';
import { addressSchema, timeWindowSchema } from './common.js';

export const orderStatusEnum = z.enum([
  'received', 'assigned', 'in_transit', 'delivered', 'failed', 'returned',
]);
export type OrderStatus = z.infer<typeof orderStatusEnum>;

export const orderPriorityEnum = z.enum(['low', 'normal', 'high', 'urgent']);
export type OrderPriority = z.infer<typeof orderPriorityEnum>;

export const createOrderSchema = z.object({
  externalId: z.string().max(255).optional(),
  recipientName: z.string().min(1).max(255),
  recipientPhone: z.string().max(20).optional(),
  recipientEmail: z.string().email().optional(),
  pickupAddress: addressSchema.optional(),
  deliveryAddress: addressSchema,
  packageCount: z.number().int().positive().default(1),
  weight: z.number().positive().optional(),
  volume: z.number().positive().optional(),
  priority: orderPriorityEnum.default('normal'),
  timeWindow: timeWindowSchema.optional().refine(
    (tw) => !tw || new Date(tw.start) < new Date(tw.end),
    { message: 'Time window start must be before end' },
  ),
  notes: z.string().max(1000).optional(),
  requiresSignature: z.boolean().default(false),
  requiresPhoto: z.boolean().default(false),
});
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const updateOrderStatusSchema = z.object({
  status: orderStatusEnum,
  failureReason: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
});
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
