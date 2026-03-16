import { pgTable, uuid, varchar, timestamp, numeric, integer, boolean, text, jsonb, pgEnum, uniqueIndex } from 'drizzle-orm/pg-core';

// Enums
export const orderStatusEnum = pgEnum('order_status', [
  'received', 'assigned', 'in_transit', 'delivered', 'failed', 'returned',
]);

export const orderPriorityEnum = pgEnum('order_priority', [
  'low', 'normal', 'high', 'urgent',
]);

export const routeStatusEnum = pgEnum('route_status', [
  'draft', 'planned', 'in_progress', 'completed', 'cancelled',
]);

export const notificationTypeEnum = pgEnum('notification_type', [
  'delivery_completed', 'delivery_failed', 'route_started', 'route_completed',
  'driver_offline', 'system', 'team_invite', 'order_received',
]);

export const failureCategoryEnum = pgEnum('failure_category', [
  'not_home', 'wrong_address', 'access_denied', 'refused',
  'damaged', 'business_closed', 'weather', 'vehicle_issue', 'other',
]);

// Minimal table definitions needed by workers
export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  status: orderStatusEnum('status').default('received').notNull(),
  recipientName: varchar('recipient_name', { length: 255 }).notNull(),
  deliveryAddress: jsonb('delivery_address').notNull(),
  deliveryLat: numeric('delivery_lat', { precision: 10, scale: 7 }),
  deliveryLng: numeric('delivery_lng', { precision: 10, scale: 7 }),
  routeId: uuid('route_id'),
  stopSequence: integer('stop_sequence'),
  failureReason: text('failure_reason'),
  failureCategory: failureCategoryEnum('failure_category'),
  timeWindowStart: timestamp('time_window_start', { withTimezone: true }),
  timeWindowEnd: timestamp('time_window_end', { withTimezone: true }),
  notes: text('notes'),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const routes = pgTable('routes', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  status: routeStatusEnum('status').default('draft').notNull(),
  driverId: uuid('driver_id'),
  depotLat: numeric('depot_lat', { precision: 10, scale: 7 }),
  depotLng: numeric('depot_lng', { precision: 10, scale: 7 }),
  totalStops: integer('total_stops').default(0).notNull(),
  completedStops: integer('completed_stops').default(0).notNull(),
  optimizationNotes: text('optimization_notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  userId: uuid('user_id').notNull(),
  type: notificationTypeEnum('type').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  body: text('body').notNull(),
  data: jsonb('data').default({}).notNull(),
  readAt: timestamp('read_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const activityLog = pgTable('activity_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  userId: uuid('user_id'),
  action: varchar('action', { length: 100 }).notNull(),
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  entityId: uuid('entity_id'),
  metadata: jsonb('metadata').default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const drivers = pgTable('drivers', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  status: varchar('status', { length: 20 }).default('offline').notNull(),
  currentLat: numeric('current_lat', { precision: 10, scale: 7 }),
  currentLng: numeric('current_lng', { precision: 10, scale: 7 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Customer notification templates
export const notificationTemplates = pgTable('notification_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  trigger: varchar('trigger', { length: 50 }).notNull(),
  channel: varchar('channel', { length: 10 }).notNull(),
  subject: text('subject'),
  bodyTemplate: text('body_template').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Customer notification log
export const customerNotificationsLog = pgTable('customer_notifications_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  orderId: uuid('order_id').notNull(),
  channel: varchar('channel', { length: 10 }).notNull(),
  trigger: varchar('trigger', { length: 50 }).notNull(),
  recipient: varchar('recipient', { length: 255 }).notNull(),
  subject: text('subject'),
  body: text('body').notNull(),
  status: varchar('status', { length: 20 }).default('queued').notNull(),
  providerId: varchar('provider_id', { length: 255 }),
  errorMessage: text('error_message'),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Webhook endpoints
export const webhookEndpoints = pgTable('webhook_endpoints', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  url: text('url').notNull(),
  events: jsonb('events').default([]).notNull(),
  secret: varchar('secret', { length: 255 }).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  description: varchar('description', { length: 255 }),
  failureCount: integer('failure_count').default(0).notNull(),
  lastSuccessAt: timestamp('last_success_at', { withTimezone: true }),
  lastFailureAt: timestamp('last_failure_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Users (needed by notification worker for email lookup)
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  role: varchar('role', { length: 20 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Route templates
export const routeTemplatesTable = pgTable('route_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  depotAddress: jsonb('depot_address'),
  depotLat: numeric('depot_lat', { precision: 10, scale: 7 }),
  depotLng: numeric('depot_lng', { precision: 10, scale: 7 }),
  driverId: uuid('driver_id'),
  vehicleId: uuid('vehicle_id'),
  recurrenceRule: varchar('recurrence_rule', { length: 255 }).notNull(),
  recurrenceTimezone: varchar('recurrence_timezone', { length: 100 }).default('UTC').notNull(),
  orderTemplate: jsonb('order_template').default([]).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  lastGeneratedAt: timestamp('last_generated_at', { withTimezone: true }),
  nextGenerateAt: timestamp('next_generate_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Data export requests
export const dataExportRequests = pgTable('data_export_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  requestedBy: uuid('requested_by').notNull(),
  status: varchar('status', { length: 20 }).default('queued').notNull(),
  fileUrl: text('file_url'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Location history (for retention + delivery learning)
export const locationHistory = pgTable('location_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  driverId: uuid('driver_id').notNull(),
  lat: numeric('lat', { precision: 10, scale: 7 }).notNull(),
  lng: numeric('lng', { precision: 10, scale: 7 }).notNull(),
  speed: numeric('speed', { precision: 6, scale: 2 }),
  heading: numeric('heading', { precision: 6, scale: 2 }),
  accuracy: numeric('accuracy', { precision: 8, scale: 2 }),
  timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Tenants
export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Subscriptions (for deletion worker)
export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }),
  status: varchar('status', { length: 20 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Data deletion requests
export const dataDeletionRequests = pgTable('data_deletion_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  requestedBy: uuid('requested_by').notNull(),
  status: varchar('status', { length: 20 }).default('pending').notNull(),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Password reset tokens (for retention cleanup)
export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  tokenHash: varchar('token_hash', { length: 255 }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Webhook deliveries
export const webhookDeliveries = pgTable('webhook_deliveries', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  endpointId: uuid('endpoint_id').notNull(),
  event: varchar('event', { length: 100 }).notNull(),
  payload: jsonb('payload').default({}).notNull(),
  status: varchar('status', { length: 20 }).default('pending').notNull(),
  httpStatus: integer('http_status'),
  responseBody: text('response_body'),
  attempts: integer('attempts').default(0).notNull(),
  nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Address intelligence — the brain's memory per delivery address
export const addressIntelligence = pgTable('address_intelligence', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  addressHash: varchar('address_hash', { length: 64 }).notNull(),
  addressNormalized: jsonb('address_normalized').notNull(),
  deliveryLat: numeric('delivery_lat', { precision: 10, scale: 7 }),
  deliveryLng: numeric('delivery_lng', { precision: 10, scale: 7 }),
  avgServiceTimeSeconds: numeric('avg_service_time_seconds', { precision: 10, scale: 2 }),
  successfulDeliveries: integer('successful_deliveries').default(0).notNull(),
  failedDeliveries: integer('failed_deliveries').default(0).notNull(),
  totalDeliveries: integer('total_deliveries').default(0).notNull(),
  bestDeliveryHours: jsonb('best_delivery_hours').default([]).notNull(),
  accessInstructions: jsonb('access_instructions'),
  parkingNotes: jsonb('parking_notes'),
  customerPreferences: jsonb('customer_preferences'),
  commonFailureReasons: jsonb('common_failure_reasons').default([]).notNull(),
  lastDeliveryAt: timestamp('last_delivery_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('idx_address_intelligence_tenant_hash').on(table.tenantId, table.addressHash),
]);

// Delivery metrics — per-delivery actual vs estimated
export const deliveryMetrics = pgTable('delivery_metrics', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  orderId: uuid('order_id').notNull(),
  routeId: uuid('route_id'),
  addressIntelligenceId: uuid('address_intelligence_id'),
  estimatedArrivalAt: timestamp('estimated_arrival_at', { withTimezone: true }),
  actualArrivalAt: timestamp('actual_arrival_at', { withTimezone: true }),
  serviceTimeSeconds: integer('service_time_seconds'),
  etaErrorMinutes: numeric('eta_error_minutes', { precision: 8, scale: 2 }),
  estimatedDistanceKm: numeric('estimated_distance_km', { precision: 10, scale: 3 }),
  actualDistanceKm: numeric('actual_distance_km', { precision: 10, scale: 3 }),
  deliveryStatus: varchar('delivery_status', { length: 20 }).notNull(),
  failureCategory: failureCategoryEnum('failure_category'),
  completedAt: timestamp('completed_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Proof of delivery (needed by learning worker for notes extraction)
export const proofOfDelivery = pgTable('proof_of_delivery', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  orderId: uuid('order_id').notNull(),
  routeId: uuid('route_id'),
  driverId: uuid('driver_id'),
  notes: text('notes'),
  locationLat: numeric('location_lat', { precision: 10, scale: 7 }),
  locationLng: numeric('location_lng', { precision: 10, scale: 7 }),
  capturedAt: timestamp('captured_at', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
