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
  // Recipient
  recipient_name: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  // Address
  street: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  postal_code: z.string().optional(),
  country: z.string().optional(),
  // Coordinates (competitor aliases)
  latitude: z.string().optional(),
  lat: z.string().optional(),
  longitude: z.string().optional(),
  lng: z.string().optional(),
  lon: z.string().optional(),
  // Core fields
  packages: z.string().optional(),
  notes: z.string().max(1000).optional(),
  priority: z.string().optional(),
  // Service duration aliases
  service_duration: z.string().optional(),
  duration: z.string().optional(),
  stop_duration: z.string().optional(),
  job_time: z.string().optional(),
  serviceTime: z.string().optional(),
  // Barcode aliases
  barcode: z.string().optional(),
  tracking_number: z.string().optional(),
  // Order type aliases
  order_type: z.string().optional(),
  type: z.string().optional(),
  task_type: z.string().optional(),
  // Time window aliases
  time_window_start: z.string().optional(),
  delivery_after: z.string().optional(),
  earliest: z.string().optional(),
  twFrom: z.string().optional(),
  time_window_end: z.string().optional(),
  delivery_before: z.string().optional(),
  latest: z.string().optional(),
  twTo: z.string().optional(),
  // Weight/volume aliases
  weight: z.string().optional(),
  kg: z.string().optional(),
  lbs: z.string().optional(),
  volume: z.string().optional(),
  cbm: z.string().optional(),
  // External ID aliases
  external_id: z.string().optional(),
  order_id: z.string().optional(),
  job_id: z.string().optional(),
  task_id: z.string().optional(),
  orderNo: z.string().optional(),
}).refine(row => row.recipient_name || row.name, {
  message: 'Either recipient_name or name is required',
});

/** Resolve competitor CSV column aliases to canonical field values */
export function resolveCsvAliases(row: Record<string, string | undefined>) {
  const serviceDuration = row.service_duration || row.duration || row.stop_duration || row.job_time || row.serviceTime;
  const barcode = row.barcode || row.tracking_number;
  const orderType = row.order_type || row.type || row.task_type;
  const timeWindowStart = row.time_window_start || row.delivery_after || row.earliest || row.twFrom;
  const timeWindowEnd = row.time_window_end || row.delivery_before || row.latest || row.twTo;
  const weight = row.weight || row.kg || row.lbs;
  const volume = row.volume || row.cbm;
  const externalId = row.external_id || row.order_id || row.job_id || row.task_id || row.orderNo;
  const latitude = row.latitude || row.lat;
  const longitude = row.longitude || row.lng || row.lon;

  return {
    serviceDurationMinutes: serviceDuration ? parseInt(serviceDuration) || undefined : undefined,
    barcodes: barcode ? [barcode] : [],
    orderType: orderType && ['delivery', 'pickup', 'pickup_and_delivery'].includes(orderType) ? orderType as 'delivery' | 'pickup' | 'pickup_and_delivery' : undefined,
    timeWindowStart: timeWindowStart || undefined,
    timeWindowEnd: timeWindowEnd || undefined,
    weight: weight ? parseFloat(weight) || undefined : undefined,
    volume: volume ? parseFloat(volume) || undefined : undefined,
    externalId: externalId || undefined,
    latitude: latitude ? parseFloat(latitude) || undefined : undefined,
    longitude: longitude ? parseFloat(longitude) || undefined : undefined,
  };
}

export const csvImportSchema = z.object({
  orders: z.array(csvImportRowSchema).min(1).max(5000),
});
export type CsvImportInput = z.infer<typeof csvImportSchema>;
