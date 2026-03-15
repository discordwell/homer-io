import { z } from 'zod';

export const createPodSchema = z.object({
  signatureUrl: z.string().optional(),
  photoUrls: z.array(z.string()).max(4).default([]),
  notes: z.string().max(1000).optional(),
  recipientNameSigned: z.string().max(255).optional(),
  locationLat: z.number().min(-90).max(90).optional(),
  locationLng: z.number().min(-180).max(180).optional(),
});
export type CreatePodInput = z.infer<typeof createPodSchema>;

export const podResponseSchema = z.object({
  id: z.string().uuid(),
  orderId: z.string().uuid(),
  routeId: z.string().uuid().nullable(),
  driverId: z.string().uuid().nullable(),
  signatureUrl: z.string().nullable(),
  photoUrls: z.array(z.string()),
  notes: z.string().nullable(),
  recipientNameSigned: z.string().nullable(),
  locationLat: z.string().nullable(),
  locationLng: z.string().nullable(),
  capturedAt: z.string(),
  createdAt: z.string(),
});
export type PodResponse = z.infer<typeof podResponseSchema>;
