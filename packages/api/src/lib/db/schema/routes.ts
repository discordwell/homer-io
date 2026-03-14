import { pgTable, uuid, varchar, timestamp, numeric, integer, jsonb, pgEnum, text } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
import { drivers } from './drivers.js';
import { vehicles } from './vehicles.js';

export const routeStatusEnum = pgEnum('route_status', [
  'draft', 'planned', 'in_progress', 'completed', 'cancelled',
]);

export const routes = pgTable('routes', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  status: routeStatusEnum('status').default('draft').notNull(),
  driverId: uuid('driver_id').references(() => drivers.id, { onDelete: 'set null' }),
  vehicleId: uuid('vehicle_id').references(() => vehicles.id, { onDelete: 'set null' }),
  depotAddress: jsonb('depot_address'),
  depotLat: numeric('depot_lat', { precision: 10, scale: 7 }),
  depotLng: numeric('depot_lng', { precision: 10, scale: 7 }),
  plannedStartAt: timestamp('planned_start_at', { withTimezone: true }),
  plannedEndAt: timestamp('planned_end_at', { withTimezone: true }),
  actualStartAt: timestamp('actual_start_at', { withTimezone: true }),
  actualEndAt: timestamp('actual_end_at', { withTimezone: true }),
  totalStops: integer('total_stops').default(0).notNull(),
  completedStops: integer('completed_stops').default(0).notNull(),
  totalDistance: numeric('total_distance', { precision: 10, scale: 2 }),
  totalDuration: integer('total_duration'),
  optimizationNotes: text('optimization_notes'),
  waypoints: jsonb('waypoints').default([]).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
