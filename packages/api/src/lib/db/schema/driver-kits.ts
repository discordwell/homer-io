import { pgTable, uuid, timestamp, numeric, integer, text, jsonb, index, pgEnum } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
import { routes } from './routes.js';
import { drivers } from './drivers.js';
import { deliveryManifests } from './delivery-manifests.js';

export const kitStatusEnum = pgEnum('kit_status', [
  'loading', 'loaded', 'in_transit', 'reconciling', 'reconciled',
]);

export const driverKits = pgTable('driver_kits', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  routeId: uuid('route_id').references(() => routes.id, { onDelete: 'set null' }),
  driverId: uuid('driver_id').references(() => drivers.id, { onDelete: 'set null' }),
  manifestId: uuid('manifest_id').references(() => deliveryManifests.id, { onDelete: 'set null' }),
  status: kitStatusEnum('status').default('loading').notNull(),
  loadedAt: timestamp('loaded_at', { withTimezone: true }),
  reconciledAt: timestamp('reconciled_at', { withTimezone: true }),
  totalItemsLoaded: integer('total_items_loaded').default(0),
  totalValueLoaded: numeric('total_value_loaded', { precision: 10, scale: 2 }),
  totalWeightLoaded: numeric('total_weight_loaded', { precision: 10, scale: 2 }),
  items: jsonb('items').default([]).notNull(),
  returnedItems: jsonb('returned_items').default([]).notNull(),
  reconciledBy: uuid('reconciled_by'),
  discrepancies: jsonb('discrepancies').default([]),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_kits_tenant_route').on(table.tenantId, table.routeId),
  index('idx_kits_tenant_driver').on(table.tenantId, table.driverId),
]);
