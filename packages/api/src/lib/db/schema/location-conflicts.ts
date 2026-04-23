import { pgTable, uuid, numeric, timestamp, pgEnum, index } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
import { drivers } from './drivers.js';
import { vehicles } from './vehicles.js';

export const locationSourceEnum = pgEnum('location_source', [
  'driver_app', 'samsara', 'motive', 'geotab',
]);

export const locationConflicts = pgTable('location_conflicts', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  driverId: uuid('driver_id').references(() => drivers.id, { onDelete: 'cascade' }),
  vehicleId: uuid('vehicle_id').references(() => vehicles.id, { onDelete: 'cascade' }),
  sourceA: locationSourceEnum('source_a').notNull(),
  sourceB: locationSourceEnum('source_b').notNull(),
  distanceMeters: numeric('distance_meters', { precision: 10, scale: 2 }).notNull(),
  latA: numeric('lat_a', { precision: 10, scale: 7 }).notNull(),
  lngA: numeric('lng_a', { precision: 10, scale: 7 }).notNull(),
  latB: numeric('lat_b', { precision: 10, scale: 7 }).notNull(),
  lngB: numeric('lng_b', { precision: 10, scale: 7 }).notNull(),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_location_conflicts_tenant_ts').on(table.tenantId, table.recordedAt),
]);
