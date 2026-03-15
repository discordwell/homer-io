import { pgTable, uuid, varchar, timestamp, numeric, boolean, jsonb, text, index } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
import { drivers } from './drivers.js';
import { vehicles } from './vehicles.js';

export const routeTemplates = pgTable('route_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  depotAddress: jsonb('depot_address'),
  depotLat: numeric('depot_lat', { precision: 10, scale: 7 }),
  depotLng: numeric('depot_lng', { precision: 10, scale: 7 }),
  driverId: uuid('driver_id').references(() => drivers.id, { onDelete: 'set null' }),
  vehicleId: uuid('vehicle_id').references(() => vehicles.id, { onDelete: 'set null' }),
  recurrenceRule: varchar('recurrence_rule', { length: 255 }).notNull(),
  recurrenceTimezone: varchar('recurrence_timezone', { length: 100 }).default('UTC').notNull(),
  orderTemplate: jsonb('order_template').default([]).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  lastGeneratedAt: timestamp('last_generated_at', { withTimezone: true }),
  nextGenerateAt: timestamp('next_generate_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_route_templates_tenant_active').on(table.tenantId, table.isActive),
  index('idx_route_templates_next_generate').on(table.nextGenerateAt),
]);
