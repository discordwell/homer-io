import { pgTable, uuid, varchar, timestamp, integer, text, pgEnum } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';

export const invoiceStatusEnum = pgEnum('invoice_status', [
  'draft', 'open', 'paid', 'void', 'uncollectible',
]);

export const invoices = pgTable('invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  stripeInvoiceId: varchar('stripe_invoice_id', { length: 255 }).notNull().unique(),
  status: invoiceStatusEnum('status').default('draft').notNull(),
  amountDue: integer('amount_due').default(0).notNull(),
  amountPaid: integer('amount_paid').default(0).notNull(),
  currency: varchar('currency', { length: 3 }).default('usd').notNull(),
  invoiceUrl: text('invoice_url'),
  invoicePdf: text('invoice_pdf'),
  periodStart: timestamp('period_start', { withTimezone: true }),
  periodEnd: timestamp('period_end', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
