import { pgTable, uuid, varchar, timestamp, numeric, integer, boolean, text, jsonb, pgEnum, index, date } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
import { routes } from './routes.js';
import { failureCategoryEnum } from './delivery-metrics.js';

export const orderStatusEnum = pgEnum('order_status', [
  'received', 'assigned', 'in_transit', 'delivered', 'failed', 'returned',
]);

export const orderPriorityEnum = pgEnum('order_priority', [
  'low', 'normal', 'high', 'urgent',
]);

export const orderTypeEnum = pgEnum('order_type', [
  'delivery', 'pickup', 'pickup_and_delivery',
]);

export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  externalId: varchar('external_id', { length: 255 }),
  status: orderStatusEnum('status').default('received').notNull(),
  priority: orderPriorityEnum('priority').default('normal').notNull(),
  recipientName: varchar('recipient_name', { length: 255 }).notNull(),
  recipientPhone: varchar('recipient_phone', { length: 20 }),
  recipientEmail: varchar('recipient_email', { length: 255 }),
  pickupAddress: jsonb('pickup_address'),
  deliveryAddress: jsonb('delivery_address').notNull(),
  deliveryLat: numeric('delivery_lat', { precision: 10, scale: 7 }),
  deliveryLng: numeric('delivery_lng', { precision: 10, scale: 7 }),
  packageCount: integer('package_count').default(1).notNull(),
  weight: numeric('weight', { precision: 10, scale: 2 }),
  volume: numeric('volume', { precision: 10, scale: 2 }),
  timeWindowStart: timestamp('time_window_start', { withTimezone: true }),
  timeWindowEnd: timestamp('time_window_end', { withTimezone: true }),
  serviceDurationMinutes: integer('service_duration_minutes'),
  orderType: orderTypeEnum('order_type').default('delivery').notNull(),
  barcodes: jsonb('barcodes').default([]).notNull(),
  customFields: jsonb('custom_fields').default({}).notNull(),
  notes: text('notes'),
  requiresSignature: boolean('requires_signature').default(false).notNull(),
  requiresPhoto: boolean('requires_photo').default(false).notNull(),
  failureReason: text('failure_reason'),
  failureCategory: failureCategoryEnum('failure_category'),
  routeId: uuid('route_id').references(() => routes.id, { onDelete: 'set null' }),
  stopSequence: integer('stop_sequence'),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  // Sender info (florist: sender != recipient)
  senderName: varchar('sender_name', { length: 255 }),
  senderEmail: varchar('sender_email', { length: 255 }),
  senderPhone: varchar('sender_phone', { length: 20 }),
  giftMessage: text('gift_message'),
  isGift: boolean('is_gift').default(false).notNull(),
  // Pharmacy compliance
  isControlledSubstance: boolean('is_controlled_substance').default(false).notNull(),
  controlledSchedule: varchar('controlled_schedule', { length: 10 }),
  isColdChain: boolean('is_cold_chain').default(false).notNull(),
  coldChainConfirmed: boolean('cold_chain_confirmed').default(false),
  patientDob: date('patient_dob'),
  patientDobVerified: boolean('patient_dob_verified').default(false),
  prescriberName: varchar('prescriber_name', { length: 255 }),
  prescriberNpi: varchar('prescriber_npi', { length: 20 }),
  hipaaSafeNotes: text('hipaa_safe_notes'),
  // Cash-on-delivery (cannabis) / Copay (pharmacy)
  cashAmount: numeric('cash_amount', { precision: 10, scale: 2 }),
  cashCollected: numeric('cash_collected', { precision: 10, scale: 2 }),
  paymentMethod: varchar('payment_method', { length: 20 }),
  paymentCollectedAt: timestamp('payment_collected_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_orders_tenant_status').on(table.tenantId, table.status),
  index('idx_orders_tenant_route').on(table.tenantId, table.routeId),
  index('idx_orders_tenant_status_route').on(table.tenantId, table.status, table.routeId),
  index('idx_orders_tenant_created').on(table.tenantId, table.createdAt),
]);
