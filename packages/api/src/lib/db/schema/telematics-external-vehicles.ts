import { pgTable, uuid, varchar, integer, timestamp, jsonb, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { telematicsConnections } from './telematics-connections.js';
import { vehicles } from './vehicles.js';

export const telematicsExternalVehicles = pgTable('telematics_external_vehicles', {
  id: uuid('id').primaryKey().defaultRandom(),
  connectionId: uuid('connection_id').references(() => telematicsConnections.id, { onDelete: 'cascade' }).notNull(),
  externalVehicleId: varchar('external_vehicle_id', { length: 255 }).notNull(),
  mappedVehicleId: uuid('mapped_vehicle_id').references(() => vehicles.id, { onDelete: 'set null' }),
  vin: varchar('vin', { length: 32 }),
  plate: varchar('plate', { length: 32 }),
  name: varchar('name', { length: 255 }),
  make: varchar('make', { length: 100 }),
  model: varchar('model', { length: 100 }),
  year: integer('year'),
  rawJson: jsonb('raw_json').default({}).notNull(),
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).defaultNow().notNull(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('uq_telematics_external_vehicle').on(table.connectionId, table.externalVehicleId),
  index('idx_telematics_external_vehicles_mapped').on(table.mappedVehicleId),
  index('idx_telematics_external_vehicles_vin').on(table.vin),
]);
