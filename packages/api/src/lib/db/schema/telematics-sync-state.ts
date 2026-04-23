import { pgTable, uuid, varchar, timestamp, pgEnum, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { telematicsConnections } from './telematics-connections.js';

export const telematicsSyncDomainEnum = pgEnum('telematics_sync_domain', [
  'vehicles', 'drivers', 'positions',
]);

export const telematicsSyncState = pgTable('telematics_sync_state', {
  id: uuid('id').primaryKey().defaultRandom(),
  connectionId: uuid('connection_id').references(() => telematicsConnections.id, { onDelete: 'cascade' }).notNull(),
  domain: telematicsSyncDomainEnum('domain').notNull(),
  cursor: varchar('cursor', { length: 500 }),
  watermark: timestamp('watermark', { withTimezone: true }),
  lastRunAt: timestamp('last_run_at', { withTimezone: true }),
  lastError: varchar('last_error', { length: 1000 }),
  nextDueAt: timestamp('next_due_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('uq_telematics_sync_state').on(table.connectionId, table.domain),
  index('idx_telematics_sync_state_due').on(table.nextDueAt),
]);
