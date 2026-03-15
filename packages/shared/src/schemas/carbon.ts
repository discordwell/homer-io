import { z } from 'zod';

// L/100km fuel consumption by vehicle type
export const fuelConsumption = {
  car: { gasoline: 8.5, diesel: 7.0, electric: 0, hybrid: 5.0, cng: 7.5 },
  van: { gasoline: 11.0, diesel: 9.0, electric: 0, hybrid: 7.0, cng: 9.5 },
  truck: { gasoline: 18.0, diesel: 15.0, electric: 0, hybrid: 12.0, cng: 16.0 },
  bike: { gasoline: 0, diesel: 0, electric: 0, hybrid: 0, cng: 0 },
  motorcycle: { gasoline: 4.0, diesel: 3.5, electric: 0, hybrid: 0, cng: 0 },
  cargo_bike: { gasoline: 0, diesel: 0, electric: 0, hybrid: 0, cng: 0 },
} as const;

// CO2 kg per liter of fuel
export const co2PerLiter = {
  gasoline: 2.31,
  diesel: 2.68,
  electric: 0,
  hybrid: 2.31, // uses gasoline when running ICE
  cng: 1.93,
} as const;

export const carbonOverviewSchema = z.object({
  totalCo2Kg: z.number(),
  totalDistanceKm: z.number(),
  routeCount: z.number(),
  evSavingsKg: z.number(),
  greenDeliveryPercent: z.number(),
  avgCo2PerRouteKg: z.number(),
});
export type CarbonOverview = z.infer<typeof carbonOverviewSchema>;

export const carbonByDriverSchema = z.object({
  driverId: z.string(),
  driverName: z.string(),
  totalCo2Kg: z.number(),
  totalDistanceKm: z.number(),
  routeCount: z.number(),
});
export type CarbonByDriver = z.infer<typeof carbonByDriverSchema>;
