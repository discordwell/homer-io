import { pgTable, uuid, varchar, timestamp, numeric, integer, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';

export const addressIntelligence = pgTable('address_intelligence', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  addressHash: varchar('address_hash', { length: 64 }).notNull(),
  addressNormalized: jsonb('address_normalized').notNull(),
  deliveryLat: numeric('delivery_lat', { precision: 10, scale: 7 }),
  deliveryLng: numeric('delivery_lng', { precision: 10, scale: 7 }),

  // Running delivery stats
  avgServiceTimeSeconds: numeric('avg_service_time_seconds', { precision: 10, scale: 2 }),
  successfulDeliveries: integer('successful_deliveries').default(0).notNull(),
  failedDeliveries: integer('failed_deliveries').default(0).notNull(),
  totalDeliveries: integer('total_deliveries').default(0).notNull(),

  // Time patterns: [{hour: 9, success_rate: 0.95, sample_size: 12}, ...]
  bestDeliveryHours: jsonb('best_delivery_hours').default([]).notNull(),

  // LLM-extracted fields
  accessInstructions: jsonb('access_instructions'),
  parkingNotes: jsonb('parking_notes'),
  customerPreferences: jsonb('customer_preferences'),

  // Failure patterns: [{reason: "not_home", count: 3}, ...]
  commonFailureReasons: jsonb('common_failure_reasons').default([]).notNull(),

  lastDeliveryAt: timestamp('last_delivery_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('idx_address_intelligence_tenant_hash').on(table.tenantId, table.addressHash),
  index('idx_address_intelligence_tenant').on(table.tenantId),
  index('idx_address_intelligence_coords').on(table.deliveryLat, table.deliveryLng),
]);
