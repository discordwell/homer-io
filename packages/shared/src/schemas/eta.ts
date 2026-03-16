import { z } from 'zod';

export const vehicleSpeedsKmh = {
  bike: 15,
  cargo_bike: 12,
  motorcycle: 35,
  car: 30,
  van: 28,
  truck: 22,
} as const;

export const dwellTimesMinutes = {
  bike: 2,
  cargo_bike: 3,
  motorcycle: 2,
  car: 3,
  van: 4,
  truck: 5,
} as const;

export const etaSourceEnum = z.enum(['google', 'osrm', 'haversine']);
export type EtaSource = z.infer<typeof etaSourceEnum>;

export const etaResponseSchema = z.object({
  routeId: z.string(),
  stops: z.array(z.object({
    orderId: z.string(),
    sequence: z.number(),
    etaMinutes: z.number().nullable(),
    etaTimestamp: z.string().nullable(),
    distanceKm: z.number().nullable(),
  })),
  totalEtaMinutes: z.number(),
  calculatedAt: z.string(),
  /** Which routing engine produced these ETAs. 'haversine' = degraded fallback. */
  source: etaSourceEnum.optional(),
});
export type EtaResponse = z.infer<typeof etaResponseSchema>;
