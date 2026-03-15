import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
import { routes } from './routes.js';
import { users } from './users.js';

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  routeId: uuid('route_id').references(() => routes.id, { onDelete: 'set null' }),
  senderId: uuid('sender_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  recipientId: uuid('recipient_id').references(() => users.id, { onDelete: 'cascade' }),
  body: text('body').notNull(),
  attachmentUrl: text('attachment_url'),
  readAt: timestamp('read_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_messages_tenant_route_created').on(table.tenantId, table.routeId, table.createdAt),
  index('idx_messages_tenant_recipient_created').on(table.tenantId, table.recipientId, table.createdAt),
]);
