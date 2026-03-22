import { pgTable, uuid, varchar, timestamp, numeric, integer, text, jsonb, index, uniqueIndex, pgEnum } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
import { routes } from './routes.js';
import { drivers } from './drivers.js';
import { vehicles } from './vehicles.js';

export const manifestStatusEnum = pgEnum('manifest_status', [
  'draft', 'active', 'completed', 'voided',
]);

export const deliveryManifests = pgTable('delivery_manifests', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  routeId: uuid('route_id').references(() => routes.id, { onDelete: 'set null' }),
  driverId: uuid('driver_id').references(() => drivers.id, { onDelete: 'set null' }),
  vehicleId: uuid('vehicle_id').references(() => vehicles.id, { onDelete: 'set null' }),
  manifestNumber: varchar('manifest_number', { length: 50 }).notNull(),
  status: manifestStatusEnum('status').default('draft').notNull(),
  licenseNumber: varchar('license_number', { length: 100 }),
  driverLicenseNumber: varchar('driver_license_number', { length: 50 }),
  vehicleLicensePlate: varchar('vehicle_license_plate', { length: 20 }),
  departedAt: timestamp('departed_at', { withTimezone: true }),
  returnedAt: timestamp('returned_at', { withTimezone: true }),
  totalItems: integer('total_items').default(0),
  totalValue: numeric('total_value', { precision: 10, scale: 2 }),
  totalWeight: numeric('total_weight', { precision: 10, scale: 2 }),
  items: jsonb('items').default([]).notNull(),
  pdfUrl: text('pdf_url'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('idx_manifests_tenant_number').on(table.tenantId, table.manifestNumber),
  index('idx_manifests_tenant_route').on(table.tenantId, table.routeId),
]);
