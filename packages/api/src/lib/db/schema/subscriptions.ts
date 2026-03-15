import { pgTable, uuid, varchar, timestamp, integer, pgEnum } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';

export const subscriptionPlanEnum = pgEnum('subscription_plan', [
  'starter', 'growth', 'enterprise',
]);

export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'trialing', 'active', 'past_due', 'canceled', 'unpaid',
]);

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull().unique(),
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }).notNull(),
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }),
  plan: subscriptionPlanEnum('plan').default('starter').notNull(),
  status: subscriptionStatusEnum('status').default('trialing').notNull(),
  quantity: integer('quantity').default(1).notNull(),
  currentPeriodStart: timestamp('current_period_start', { withTimezone: true }),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
  trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),
  canceledAt: timestamp('canceled_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
