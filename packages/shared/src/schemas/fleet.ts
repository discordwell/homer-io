import { z } from 'zod';

export const vehicleTypeEnum = z.enum([
  'car', 'van', 'truck', 'bike', 'motorcycle', 'cargo_bike',
]);
export type VehicleType = z.infer<typeof vehicleTypeEnum>;

export const fuelTypeEnum = z.enum([
  'gasoline', 'diesel', 'electric', 'hybrid', 'cng',
]);
export type FuelType = z.infer<typeof fuelTypeEnum>;

export const createVehicleSchema = z.object({
  name: z.string().min(1).max(255),
  type: vehicleTypeEnum,
  licensePlate: z.string().max(20).optional(),
  fuelType: fuelTypeEnum.default('gasoline'),
  capacityWeight: z.number().positive().optional(),
  capacityVolume: z.number().positive().optional(),
  capacityCount: z.number().int().positive().optional(),
  evRange: z.number().positive().optional(),
});
export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;

export const createDriverSchema = z.object({
  userId: z.string().uuid().optional(),
  name: z.string().min(1).max(255),
  email: z.string().email().optional(),
  phone: z.string().max(20).optional(),
  licenseNumber: z.string().max(50).optional(),
  skillTags: z.array(z.string()).default([]),
});
export type CreateDriverInput = z.infer<typeof createDriverSchema>;

export const driverStatusEnum = z.enum([
  'available', 'on_route', 'on_break', 'offline',
]);
export type DriverStatus = z.infer<typeof driverStatusEnum>;
