import { pgTable, uuid, varchar, timestamp, jsonb, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { telematicsConnections } from './telematics-connections.js';
import { drivers } from './drivers.js';

export const telematicsExternalDrivers = pgTable('telematics_external_drivers', {
  id: uuid('id').primaryKey().defaultRandom(),
  connectionId: uuid('connection_id').references(() => telematicsConnections.id, { onDelete: 'cascade' }).notNull(),
  externalDriverId: varchar('external_driver_id', { length: 255 }).notNull(),
  mappedDriverId: uuid('mapped_driver_id').references(() => drivers.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 255 }),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 32 }),
  licenseNumber: varchar('license_number', { length: 64 }),
  rawJson: jsonb('raw_json').default({}).notNull(),
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).defaultNow().notNull(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('uq_telematics_external_driver').on(table.connectionId, table.externalDriverId),
  index('idx_telematics_external_drivers_mapped').on(table.mappedDriverId),
]);
