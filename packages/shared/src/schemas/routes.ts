import { z } from 'zod';
import { addressSchema } from './common.js';

export const routeStatusEnum = z.enum([
  'draft', 'planned', 'in_progress', 'completed', 'cancelled',
]);
export type RouteStatus = z.infer<typeof routeStatusEnum>;

export const createRouteSchema = z.object({
  name: z.string().min(1).max(255),
  driverId: z.string().uuid().optional(),
  vehicleId: z.string().uuid().optional(),
  depotAddress: addressSchema.optional(),
  depotLat: z.number().min(-90).max(90).optional(),
  depotLng: z.number().min(-180).max(180).optional(),
  plannedStartAt: z.string().datetime().optional(),
  plannedEndAt: z.string().datetime().optional(),
  orderIds: z.array(z.string().uuid()).max(200).optional(),
});
export type CreateRouteInput = z.infer<typeof createRouteSchema>;

export const csvImportRowSchema = z.object({
  recipient_name: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  street: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  postal_code: z.string().optional(),
  country: z.string().optional(),
  packages: z.string().optional(),
  notes: z.string().max(1000).optional(),
  priority: z.string().optional(),
}).refine(row => row.recipient_name || row.name, {
  message: 'Either recipient_name or name is required',
});

export const csvImportSchema = z.object({
  orders: z.array(csvImportRowSchema).min(1).max(5000),
});
export type CsvImportInput = z.infer<typeof csvImportSchema>;
