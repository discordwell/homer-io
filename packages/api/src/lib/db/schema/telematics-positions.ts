import { pgTable, uuid, varchar, numeric, integer, timestamp, bigserial, index } from 'drizzle-orm/pg-core';
import { telematicsConnections } from './telematics-connections.js';

export const telematicsPositions = pgTable('telematics_positions', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey(),
  connectionId: uuid('connection_id').references(() => telematicsConnections.id, { onDelete: 'cascade' }).notNull(),
  externalVehicleId: varchar('external_vehicle_id', { length: 255 }).notNull(),
  lat: numeric('lat', { precision: 10, scale: 7 }).notNull(),
  lng: numeric('lng', { precision: 10, scale: 7 }).notNull(),
  speed: numeric('speed', { precision: 6, scale: 2 }),
  heading: integer('heading'),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull(),
  ingestedAt: timestamp('ingested_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_telematics_positions_conn_vehicle_ts').on(table.connectionId, table.externalVehicleId, table.recordedAt),
  index('idx_telematics_positions_recorded_at').on(table.recordedAt),
]);
