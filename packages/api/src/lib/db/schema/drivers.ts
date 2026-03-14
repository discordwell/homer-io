import { pgTable, uuid, varchar, timestamp, jsonb, numeric, pgEnum } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
import { users } from './users.js';
import { vehicles } from './vehicles.js';

export const driverStatusEnum = pgEnum('driver_status', [
  'available', 'on_route', 'on_break', 'offline',
]);

export const drivers = pgTable('drivers', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 20 }),
  licenseNumber: varchar('license_number', { length: 50 }),
  status: driverStatusEnum('status').default('offline').notNull(),
  currentVehicleId: uuid('current_vehicle_id').references(() => vehicles.id, { onDelete: 'set null' }),
  skillTags: jsonb('skill_tags').default([]).notNull(),
  currentLat: numeric('current_lat', { precision: 10, scale: 7 }),
  currentLng: numeric('current_lng', { precision: 10, scale: 7 }),
  lastLocationAt: timestamp('last_location_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
