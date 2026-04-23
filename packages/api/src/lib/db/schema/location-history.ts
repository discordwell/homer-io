import { pgTable, uuid, numeric, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
import { drivers } from './drivers.js';
import { locationSourceEnum } from './location-conflicts.js';

export const locationHistory = pgTable('location_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  driverId: uuid('driver_id').references(() => drivers.id, { onDelete: 'cascade' }).notNull(),
  lat: numeric('lat', { precision: 10, scale: 7 }).notNull(),
  lng: numeric('lng', { precision: 10, scale: 7 }).notNull(),
  speed: numeric('speed', { precision: 6, scale: 2 }),
  heading: integer('heading'),
  accuracy: numeric('accuracy', { precision: 8, scale: 2 }),
  source: locationSourceEnum('source').default('driver_app').notNull(),
  timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_location_history_tenant_driver_ts').on(table.tenantId, table.driverId, table.timestamp),
]);
