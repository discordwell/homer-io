import { z } from 'zod';
import { addressSchema, timeWindowSchema } from './common.js';

export const orderStatusEnum = z.enum([
  'received', 'assigned', 'in_transit', 'delivered', 'failed', 'returned',
]);
export type OrderStatus = z.infer<typeof orderStatusEnum>;

export const orderPriorityEnum = z.enum(['low', 'normal', 'high', 'urgent']);
export type OrderPriority = z.infer<typeof orderPriorityEnum>;

export const orderTypeEnum = z.enum(['delivery', 'pickup', 'pickup_and_delivery']);
export type OrderType = z.infer<typeof orderTypeEnum>;

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
  serviceDurationMinutes: z.number().int().min(1).max(480).optional(),
  orderType: orderTypeEnum.default('delivery'),
  barcodes: z.array(z.string().max(100)).max(50).default([]),
  customFields: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
  notes: z.string().max(1000).optional(),
  requiresSignature: z.boolean().default(false),
  requiresPhoto: z.boolean().default(false),
  // Sender info (florist: sender != recipient)
  senderName: z.string().max(255).optional(),
  senderEmail: z.string().email().optional(),
  senderPhone: z.string().max(20).optional(),
  giftMessage: z.string().max(2000).optional(),
  isGift: z.boolean().default(false),
  // Pharmacy compliance
  isControlledSubstance: z.boolean().default(false),
  controlledSchedule: z.enum(['II', 'III', 'IV', 'V']).optional(),
  isColdChain: z.boolean().default(false),
  patientDob: z.string().date().optional(),
  prescriberName: z.string().max(255).optional(),
  prescriberNpi: z.string().max(20).optional(),
  hipaaSafeNotes: z.string().max(2000).optional(),
  // Grocery: substitutions + temperature
  substitutionAllowed: z.boolean().default(true),
  substitutionNotes: z.string().max(1000).optional(),
  temperatureZone: z.enum(['frozen', 'refrigerated', 'ambient']).optional(),
  // Furniture: crew + assembly + haul-away
  crewSize: z.number().int().min(1).max(4).default(1),
  assemblyRequired: z.boolean().default(false),
  haulAway: z.boolean().default(false),
  // Cash-on-delivery (cannabis) / Copay (pharmacy)
  cashAmount: z.number().min(0).optional(),
  paymentMethod: z.enum(['cash', 'prepaid', 'card']).optional(),
});
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const updateOrderStatusSchema = z.object({
  status: orderStatusEnum,
  failureReason: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
});
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
