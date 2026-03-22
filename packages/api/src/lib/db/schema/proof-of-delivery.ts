import { pgTable, uuid, varchar, timestamp, numeric, text, jsonb, index, boolean, date } from 'drizzle-orm/pg-core';
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
  // ID verification (cannabis compliance)
  idPhotoUrl: text('id_photo_url'),
  idNumber: varchar('id_number', { length: 50 }),
  idDob: date('id_dob'),
  idExpirationDate: date('id_expiration_date'),
  idNameOnId: varchar('id_name_on_id', { length: 255 }),
  idVerifiedAt: timestamp('id_verified_at', { withTimezone: true }),
  ageVerified: boolean('age_verified').default(false).notNull(),
  capturedAt: timestamp('captured_at', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_pod_tenant').on(table.tenantId),
  index('idx_pod_route').on(table.routeId),
]);
