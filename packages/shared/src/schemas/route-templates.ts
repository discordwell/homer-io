import { z } from 'zod';
import { addressSchema } from './common.js';

export const orderTemplateItemSchema = z.object({
  recipientName: z.string().min(1).max(255),
  recipientPhone: z.string().max(20).optional(),
  recipientEmail: z.string().email().optional(),
  deliveryAddress: addressSchema,
  packageCount: z.number().int().positive().default(1),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  notes: z.string().max(1000).optional(),
  requiresSignature: z.boolean().default(false),
  requiresPhoto: z.boolean().default(false),
});

export const createRouteTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  depotAddress: addressSchema.optional(),
  depotLat: z.number().min(-90).max(90).optional(),
  depotLng: z.number().min(-180).max(180).optional(),
  driverId: z.string().uuid().optional(),
  vehicleId: z.string().uuid().optional(),
  recurrenceRule: z.string().min(1).max(255),
  recurrenceTimezone: z.string().max(100).default('UTC'),
  orderTemplate: z.array(orderTemplateItemSchema).default([]),
  isActive: z.boolean().default(true),
});
export type CreateRouteTemplateInput = z.infer<typeof createRouteTemplateSchema>;

export const routeTemplateResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  recurrenceRule: z.string(),
  recurrenceTimezone: z.string(),
  isActive: z.boolean(),
  lastGeneratedAt: z.string().datetime().nullable(),
  nextGenerateAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});
export type RouteTemplateResponse = z.infer<typeof routeTemplateResponseSchema>;
