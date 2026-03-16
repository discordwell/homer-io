import { z } from 'zod';

export const subscriptionPlanEnum = z.enum(['free', 'standard', 'growth', 'scale', 'enterprise']);
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

export const meteredUsageSchema = z.object({
  aiOptimizations: z.number(),
  aiDispatches: z.number(),
  aiChatMessages: z.number(),
  smsSent: z.number(),
  emailsSent: z.number(),
  podStorageMb: z.number(),
});
export type MeteredUsage = z.infer<typeof meteredUsageSchema>;

export const subscriptionResponseSchema = z.object({
  plan: subscriptionPlanEnum,
  status: subscriptionStatusEnum,
  ordersLimit: z.number(),
  ordersUsed: z.number(),
  payAsYouGoEnabled: z.boolean(),
  trialEndsAt: z.string().nullable(),
  currentPeriodEnd: z.string().nullable(),
  canceledAt: z.string().nullable(),
  usage: z.object({
    driverCount: z.number(),
    orderCount: z.number(),
    routeCount: z.number(),
  }),
  metered: meteredUsageSchema,
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

export const payAsYouGoRequestSchema = z.object({
  enabled: z.boolean(),
});
export type PayAsYouGoRequest = z.infer<typeof payAsYouGoRequestSchema>;

// --- Plan definitions ---

export const planFeatures = {
  free: {
    name: 'Free',
    ordersPerMonth: 100,
    price: { monthly: 0, annual: 0 },
    features: [
      'Up to 100 orders/month',
      'Unlimited drivers',
      'All features included',
      'AI route optimization (10 free/mo)',
      'Email notifications (500 free/mo)',
    ],
  },
  standard: {
    name: 'Standard',
    ordersPerMonth: 1_000,
    price: { monthly: 14900, annual: 11920 }, // cents
    features: [
      'Up to 1,000 orders/month',
      'Unlimited drivers',
      'All features included',
      'AI route optimization (10 free/mo)',
      'Email + SMS notifications',
      'E-commerce integrations',
    ],
  },
  growth: {
    name: 'Growth',
    ordersPerMonth: 5_000,
    price: { monthly: 34900, annual: 27920 },
    popular: true,
    features: [
      'Up to 5,000 orders/month',
      'Unlimited drivers',
      'All features included',
      'AI route optimization (10 free/mo)',
      'Email + SMS notifications',
      'E-commerce integrations',
      'Priority support',
    ],
  },
  scale: {
    name: 'Scale',
    ordersPerMonth: 15_000,
    price: { monthly: 69900, annual: 55920 },
    features: [
      'Up to 15,000 orders/month',
      'Unlimited drivers',
      'All features included',
      'AI route optimization (10 free/mo)',
      'Email + SMS notifications',
      'E-commerce integrations',
      'Priority support',
      'Custom branding',
    ],
  },
  enterprise: {
    name: 'Enterprise',
    ordersPerMonth: Infinity,
    price: { monthly: -1, annual: -1 }, // custom pricing
    features: [
      'Unlimited orders',
      'Unlimited drivers',
      'All features included',
      'Dedicated account manager',
      'Custom integrations',
      'SLA guarantee',
    ],
  },
} as const;

// Metered usage: free quotas per month (same for all tiers)
export const meteredQuotas = {
  aiOptimizations: 10,
  aiDispatches: 5,
  aiChatMessages: 50,
  smsSent: 50,
  emailsSent: 500,
  podStorageMb: 1024, // 1 GB
} as const;

// Metered usage: at-cost rates in cents
export const meteredRates = {
  aiOptimizations: 5,    // $0.05/run
  aiDispatches: 15,      // $0.15/batch
  aiChatMessages: 2,     // $0.02/message
  smsSent: 1,            // $0.01/SMS
  emailsSent: 0,         // free
  podStorageMb: 10,      // $0.10/GB (10 cents per 1024 MB)
} as const;

export type MeteredFeature = keyof typeof meteredQuotas;
