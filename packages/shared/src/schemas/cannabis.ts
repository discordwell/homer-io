import { z } from 'zod';

// ---------------------------------------------------------------------------
// Cannabis tenant settings
// ---------------------------------------------------------------------------

export const cannabisSettingsSchema = z.object({
  licenseNumber: z.string().min(1).max(100),
  state: z.string().length(2),
  maxVehicleValue: z.number().positive().default(5000),
  maxVehicleWeight: z.number().positive().nullable().default(null),
  requireIdVerification: z.boolean().default(true),
  requireSignature: z.boolean().default(true),
  requirePhoto: z.boolean().default(true),
  minimumAge: z.number().int().min(18).max(21).default(21),
  allowCashOnDelivery: z.boolean().default(true),
  manifestPrefix: z.string().max(10).default('MAN'),
  deliveryRadiusMiles: z.number().positive().nullable().default(null),
  allowedZipCodes: z.array(z.string()).default([]),
  jurisdiction: z.string().max(100).default(''),
});
export type CannabisSettings = z.infer<typeof cannabisSettingsSchema>;

export const updateCannabisSettingsSchema = cannabisSettingsSchema.partial();
export type UpdateCannabisSettingsInput = z.infer<typeof updateCannabisSettingsSchema>;

// ---------------------------------------------------------------------------
// Delivery manifests
// ---------------------------------------------------------------------------

export const manifestProductSchema = z.object({
  name: z.string(),
  quantity: z.number().int().positive(),
  weight: z.number().optional(),
  trackingTag: z.string().optional(),
  price: z.number().optional(),
});

export const manifestItemSchema = z.object({
  orderId: z.string().uuid(),
  recipientName: z.string(),
  deliveryAddress: z.string().optional(),
  products: z.array(manifestProductSchema).min(1),
});
export type ManifestItem = z.infer<typeof manifestItemSchema>;

export const createManifestSchema = z.object({
  routeId: z.string().uuid(),
  items: z.array(manifestItemSchema).min(1),
  notes: z.string().max(1000).optional(),
});
export type CreateManifestInput = z.infer<typeof createManifestSchema>;

// ---------------------------------------------------------------------------
// ID verification
// ---------------------------------------------------------------------------

export const idVerificationInputSchema = z.object({
  idPhotoBase64: z.string().min(1).max(10_000_000), // ~7MB base64
  idNumber: z.string().min(1).max(20),
  idDob: z.string().date(),
  idExpirationDate: z.string().date(),
  idNameOnId: z.string().max(255),
  orderId: z.string().uuid(),
});
export type IdVerificationInput = z.infer<typeof idVerificationInputSchema>;
