import { pgTable, uuid, varchar, timestamp, numeric, integer, boolean, pgEnum } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';

export const vehicleTypeEnum = pgEnum('vehicle_type', [
  'car', 'van', 'truck', 'bike', 'motorcycle', 'cargo_bike',
]);

export const fuelTypeEnum = pgEnum('fuel_type', [
  'gasoline', 'diesel', 'electric', 'hybrid', 'cng',
]);

export const vehicles = pgTable('vehicles', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  type: vehicleTypeEnum('type').notNull(),
  licensePlate: varchar('license_plate', { length: 20 }),
  fuelType: fuelTypeEnum('fuel_type').default('gasoline').notNull(),
  capacityWeight: numeric('capacity_weight', { precision: 10, scale: 2 }),
  capacityVolume: numeric('capacity_volume', { precision: 10, scale: 2 }),
  capacityCount: integer('capacity_count'),
  evRange: numeric('ev_range', { precision: 10, scale: 2 }),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
