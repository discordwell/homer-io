import { pgTable, uuid, varchar, timestamp, numeric, integer, pgEnum, index } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
import { orders } from './orders.js';
import { routes } from './routes.js';
import { addressIntelligence } from './address-intelligence.js';

export const failureCategoryEnum = pgEnum('failure_category', [
  'not_home', 'wrong_address', 'access_denied', 'refused',
  'damaged', 'business_closed', 'weather', 'vehicle_issue', 'other',
]);

export const deliveryMetrics = pgTable('delivery_metrics', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  orderId: uuid('order_id').references(() => orders.id, { onDelete: 'cascade' }).notNull(),
  routeId: uuid('route_id').references(() => routes.id, { onDelete: 'set null' }),
  addressIntelligenceId: uuid('address_intelligence_id').references(() => addressIntelligence.id, { onDelete: 'set null' }),

  // Timing
  estimatedArrivalAt: timestamp('estimated_arrival_at', { withTimezone: true }),
  actualArrivalAt: timestamp('actual_arrival_at', { withTimezone: true }),
  serviceTimeSeconds: integer('service_time_seconds'),
  etaErrorMinutes: numeric('eta_error_minutes', { precision: 8, scale: 2 }),

  // Distance
  estimatedDistanceKm: numeric('estimated_distance_km', { precision: 10, scale: 3 }),
  actualDistanceKm: numeric('actual_distance_km', { precision: 10, scale: 3 }),

  // Outcome
  deliveryStatus: varchar('delivery_status', { length: 20 }).notNull(),
  failureCategory: failureCategoryEnum('failure_category'),

  completedAt: timestamp('completed_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_delivery_metrics_tenant').on(table.tenantId),
  index('idx_delivery_metrics_order').on(table.orderId),
  index('idx_delivery_metrics_address_intel').on(table.addressIntelligenceId),
  index('idx_delivery_metrics_tenant_completed').on(table.tenantId, table.completedAt),
]);
