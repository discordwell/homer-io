import { z } from 'zod';

export const subscriptionPlanEnum = z.enum(['starter', 'growth', 'enterprise']);
export type SubscriptionPlan = z.infer<typeof subscriptionPlanEnum>;

export const subscriptionStatusEnum = z.enum(['trialing', 'active', 'past_due', 'canceled', 'unpaid']);
export type SubscriptionStatus = z.infer<typeof subscriptionStatusEnum>;

export const billingInterval = z.enum(['monthly', 'annual']);
export type BillingInterval = z.infer<typeof billingInterval>;

export const checkoutRequestSchema = z.object({
  plan: subscriptionPlanEnum,
  interval: billingInterval.default('monthly'),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});
export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;

export const changePlanRequestSchema = z.object({
  plan: subscriptionPlanEnum,
  interval: billingInterval.default('monthly'),
});
export type ChangePlanRequest = z.infer<typeof changePlanRequestSchema>;

export const subscriptionResponseSchema = z.object({
  plan: subscriptionPlanEnum,
  status: subscriptionStatusEnum,
  quantity: z.number(),
  trialEndsAt: z.string().nullable(),
  currentPeriodEnd: z.string().nullable(),
  canceledAt: z.string().nullable(),
  usage: z.object({
    driverCount: z.number(),
    orderCount: z.number(),
    routeCount: z.number(),
  }),
});
export type SubscriptionResponse = z.infer<typeof subscriptionResponseSchema>;

export const invoiceResponseSchema = z.object({
  id: z.string(),
  status: z.string(),
  amountDue: z.number(),
  amountPaid: z.number(),
  currency: z.string(),
  invoiceUrl: z.string().nullable(),
  invoicePdf: z.string().nullable(),
  periodStart: z.string().nullable(),
  periodEnd: z.string().nullable(),
  createdAt: z.string(),
});
export type InvoiceResponse = z.infer<typeof invoiceResponseSchema>;

export const planFeatures = {
  starter: {
    name: 'Starter',
    price: { monthly: 4900, annual: 3920 }, // cents per driver
    ordersPerDriver: 500,
    optimization: 'manual',
    notifications: ['email'],
    webhookEndpoints: 3,
    integrations: false,
  },
  growth: {
    name: 'Growth',
    price: { monthly: 5900, annual: 4720 },
    ordersPerDriver: Infinity,
    optimization: 'ai',
    notifications: ['email', 'sms'],
    webhookEndpoints: 10,
    integrations: true,
  },
  enterprise: {
    name: 'Enterprise',
    price: { monthly: 6500, annual: 5200 },
    ordersPerDriver: Infinity,
    optimization: 'ai_auto_dispatch',
    notifications: ['email', 'sms', 'branded'],
    webhookEndpoints: Infinity,
    integrations: true,
  },
} as const;
