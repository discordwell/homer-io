import { pgTable, uuid, varchar, timestamp, numeric, text, jsonb, index } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
import { orders } from './orders.js';
import { routes } from './routes.js';
import { drivers } from './drivers.js';

export const proofOfDelivery = pgTable('proof_of_delivery', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  orderId: uuid('order_id').references(() => orders.id, { onDelete: 'cascade' }).notNull().unique(),
  routeId: uuid('route_id').references(() => routes.id, { onDelete: 'set null' }),
  driverId: uuid('driver_id').references(() => drivers.id, { onDelete: 'set null' }),
  signatureUrl: text('signature_url'),
  photoUrls: jsonb('photo_urls').default([]).notNull(),
  notes: text('notes'),
  recipientNameSigned: varchar('recipient_name_signed', { length: 255 }),
  locationLat: numeric('location_lat', { precision: 10, scale: 7 }),
  locationLng: numeric('location_lng', { precision: 10, scale: 7 }),
  capturedAt: timestamp('captured_at', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_pod_tenant').on(table.tenantId),
  index('idx_pod_route').on(table.routeId),
]);
