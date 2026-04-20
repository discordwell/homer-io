import { pgTable, uuid, varchar, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';

/**
 * Email-link verification tokens. Used when a logged-in user wants to prove
 * ownership of a work email (potentially joining a different tenant).
 *
 * Stored in a dedicated table rather than on the user row so that:
 *   - Multiple outstanding requests can coexist safely.
 *   - Atomic single-use consumption is trivial (UPDATE ... WHERE used_at IS NULL
 *     RETURNING ...).
 *   - Password reset can cleanly invalidate all outstanding tokens.
 */
export const emailLinkTokens = pgTable('email_link_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  tokenHash: varchar('token_hash', { length: 255 }).notNull(),
  workEmail: varchar('work_email', { length: 255 }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_email_link_tokens_token_hash').on(table.tokenHash),
  index('idx_email_link_tokens_user_id').on(table.userId),
]);
