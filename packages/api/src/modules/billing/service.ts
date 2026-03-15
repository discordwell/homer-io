import Stripe from 'stripe';
import { eq, and, sql, desc } from 'drizzle-orm';
import { db } from '../../lib/db/index.js';
import { subscriptions } from '../../lib/db/schema/subscriptions.js';
import { invoices } from '../../lib/db/schema/invoices.js';
import { usageRecords } from '../../lib/db/schema/usage-records.js';
import { drivers } from '../../lib/db/schema/drivers.js';
import { config } from '../../config.js';
import { NotFoundError } from '../../lib/errors.js';
import { cacheDelete } from '../../lib/cache.js';
import { logActivity } from '../../lib/activity.js';

let stripe: Stripe | null = null;

function getStripe(): Stripe | null {
  if (stripe) return stripe;
  if (!config.stripe.secretKey) {
    console.warn('[billing] Stripe secret key not configured — running in mock mode');
    return null;
  }
  stripe = new Stripe(config.stripe.secretKey);
  return stripe;
}

function getPriceId(plan: string, interval: string): string {
  const key = `${plan}${interval === 'annual' ? 'Annual' : 'Monthly'}` as keyof typeof config.stripe.prices;
  return config.stripe.prices[key] || '';
}

// --- createStripeCustomer ---
export async function createStripeCustomer(
  tenantId: string,
  email: string,
  orgName: string,
) {
  const s = getStripe();

  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + 14);

  let stripeCustomerId = `cus_mock_${tenantId.slice(0, 8)}`;

  if (s) {
    const customer = await s.customers.create({
      email,
      name: orgName,
      metadata: { tenantId },
    });
    stripeCustomerId = customer.id;
  }

  const [sub] = await db
    .insert(subscriptions)
    .values({
      tenantId,
      stripeCustomerId,
      plan: 'starter',
      status: 'trialing',
      quantity: 1,
      trialEndsAt: trialEnd,
    })
    .returning();

  return sub;
}

// --- createCheckoutSession ---
export async function createCheckoutSession(
  tenantId: string,
  plan: string,
  interval: string,
  urls: { successUrl?: string; cancelUrl?: string },
) {
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.tenantId, tenantId))
    .limit(1);

  if (!sub) throw new NotFoundError('No subscription found for this tenant');

  const s = getStripe();
  if (!s) {
    // Mock mode for dev
    await logActivity({ tenantId, action: 'checkout_session_created', entityType: 'subscription' });
    return { url: urls.successUrl || '/settings?tab=billing&checkout=mock' };
  }

  await logActivity({ tenantId, action: 'checkout_session_created', entityType: 'subscription' });

  const priceId = getPriceId(plan, interval);
  if (!priceId) {
    throw new Error(`No Stripe price ID configured for ${plan}/${interval}`);
  }

  const session = await s.checkout.sessions.create({
    customer: sub.stripeCustomerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: sub.quantity }],
    success_url: urls.successUrl || `${config.cors.origin[0]}/settings?tab=billing&checkout=success`,
    cancel_url: urls.cancelUrl || `${config.cors.origin[0]}/settings?tab=billing&checkout=cancel`,
    metadata: { tenantId, plan, interval },
    subscription_data: {
      metadata: { tenantId, plan },
    },
  });

  return { url: session.url };
}

// --- createPortalSession ---
export async function createPortalSession(tenantId: string, returnUrl: string) {
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.tenantId, tenantId))
    .limit(1);

  if (!sub) throw new NotFoundError('No subscription found for this tenant');

  const s = getStripe();
  if (!s) {
    return { url: returnUrl || '/settings?tab=billing' };
  }

  const session = await s.billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: returnUrl || `${config.cors.origin[0]}/settings?tab=billing`,
  });

  return { url: session.url };
}

// --- getSubscription ---
export async function getSubscription(tenantId: string) {
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.tenantId, tenantId))
    .limit(1);

  if (!sub) throw new NotFoundError('No subscription found for this tenant');

  // Get current period usage
  const period = new Date().toISOString().slice(0, 7); // YYYY-MM
  const [usage] = await db
    .select()
    .from(usageRecords)
    .where(and(eq(usageRecords.tenantId, tenantId), eq(usageRecords.period, period)))
    .limit(1);

  return {
    plan: sub.plan,
    status: sub.status,
    quantity: sub.quantity,
    trialEndsAt: sub.trialEndsAt?.toISOString() ?? null,
    currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
    canceledAt: sub.canceledAt?.toISOString() ?? null,
    usage: {
      driverCount: usage?.driverCount ?? 0,
      orderCount: usage?.orderCount ?? 0,
      routeCount: usage?.routeCount ?? 0,
    },
  };
}

// --- getInvoices ---
export async function getInvoices(tenantId: string, page: number, limit: number) {
  const offset = (page - 1) * limit;

  const [items, countResult] = await Promise.all([
    db.select()
      .from(invoices)
      .where(eq(invoices.tenantId, tenantId))
      .orderBy(desc(invoices.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)` })
      .from(invoices)
      .where(eq(invoices.tenantId, tenantId)),
  ]);

  const total = Number(countResult[0]?.count ?? 0);

  return {
    data: items.map((inv) => ({
      id: inv.id,
      status: inv.status,
      amountDue: inv.amountDue,
      amountPaid: inv.amountPaid,
      currency: inv.currency,
      invoiceUrl: inv.invoiceUrl,
      invoicePdf: inv.invoicePdf,
      periodStart: inv.periodStart?.toISOString() ?? null,
      periodEnd: inv.periodEnd?.toISOString() ?? null,
      createdAt: inv.createdAt.toISOString(),
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

// --- changePlan ---
export async function changePlan(tenantId: string, plan: string, interval: string) {
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.tenantId, tenantId))
    .limit(1);

  if (!sub) throw new NotFoundError('No subscription found for this tenant');

  const s = getStripe();

  if (s && sub.stripeSubscriptionId) {
    const stripeSub = await s.subscriptions.retrieve(sub.stripeSubscriptionId);
    const priceId = getPriceId(plan, interval);
    if (!priceId) throw new Error(`No Stripe price ID configured for ${plan}/${interval}`);

    await s.subscriptions.update(sub.stripeSubscriptionId, {
      items: [{ id: stripeSub.items.data[0].id, price: priceId }],
      proration_behavior: 'create_prorations',
      metadata: { plan },
    });
  }

  // Update local record
  const [updated] = await db
    .update(subscriptions)
    .set({
      plan: plan as 'starter' | 'growth' | 'enterprise',
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.tenantId, tenantId))
    .returning();

  await logActivity({ tenantId, action: 'plan_changed', entityType: 'subscription', metadata: { newPlan: plan } });

  return updated;
}

// --- syncSeats ---
export async function syncSeats(tenantId: string) {
  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(drivers)
    .where(eq(drivers.tenantId, tenantId));

  const driverCount = Math.max(1, Number(result.count));

  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.tenantId, tenantId))
    .limit(1);

  if (!sub) return;

  // Update Stripe quantity if connected
  const s = getStripe();
  if (s && sub.stripeSubscriptionId) {
    const stripeSub = await s.subscriptions.retrieve(sub.stripeSubscriptionId);
    await s.subscriptions.update(sub.stripeSubscriptionId, {
      items: [{ id: stripeSub.items.data[0].id, quantity: driverCount }],
      proration_behavior: 'create_prorations',
    });
  }

  // Update local record
  await db
    .update(subscriptions)
    .set({ quantity: driverCount, updatedAt: new Date() })
    .where(eq(subscriptions.tenantId, tenantId));

  return driverCount;
}

// --- invalidate billing cache helper ---
async function invalidateBillingCache(tenantId: string) {
  await cacheDelete(`billing:status:${tenantId}`);
}

// --- handleWebhookEvent ---
export async function handleWebhookEvent(event: Stripe.Event) {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const tenantId = session.metadata?.tenantId;
      if (!tenantId) break;

      if (session.subscription) {
        await db
          .update(subscriptions)
          .set({
            stripeSubscriptionId: session.subscription as string,
            status: 'active',
            updatedAt: new Date(),
          })
          .where(eq(subscriptions.tenantId, tenantId));
        await invalidateBillingCache(tenantId);
      }
      break;
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const stripeSub = event.data.object as Stripe.Subscription;
      const tenantId = stripeSub.metadata?.tenantId;
      if (!tenantId) break;

      const statusMap: Record<string, string> = {
        trialing: 'trialing',
        active: 'active',
        past_due: 'past_due',
        canceled: 'canceled',
        unpaid: 'unpaid',
      };

      // Compute period timestamps from latest invoice or billing_cycle_anchor
      const latestInvoice = typeof stripeSub.latest_invoice === 'object' && stripeSub.latest_invoice
        ? stripeSub.latest_invoice as Stripe.Invoice
        : null;
      const periodStart = latestInvoice?.period_start
        ? new Date(latestInvoice.period_start * 1000)
        : new Date(stripeSub.start_date * 1000);
      const periodEnd = latestInvoice?.period_end
        ? new Date(latestInvoice.period_end * 1000)
        : null;

      await db
        .update(subscriptions)
        .set({
          stripeSubscriptionId: stripeSub.id,
          status: (statusMap[stripeSub.status] || 'active') as 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid',
          quantity: stripeSub.items.data[0]?.quantity ?? 1,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          trialEndsAt: stripeSub.trial_end ? new Date(stripeSub.trial_end * 1000) : null,
          canceledAt: stripeSub.canceled_at ? new Date(stripeSub.canceled_at * 1000) : null,
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.tenantId, tenantId));
      await invalidateBillingCache(tenantId);
      break;
    }

    case 'customer.subscription.deleted': {
      const stripeSub = event.data.object as Stripe.Subscription;
      const tenantId = stripeSub.metadata?.tenantId;
      if (!tenantId) break;

      await db
        .update(subscriptions)
        .set({
          status: 'canceled',
          canceledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.tenantId, tenantId));
      await invalidateBillingCache(tenantId);
      break;
    }

    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice;
      const tenantId = (invoice.parent as any)?.subscription_details?.metadata?.tenantId
        || invoice.metadata?.tenantId;

      // Upsert invoice record
      await db
        .insert(invoices)
        .values({
          tenantId: tenantId || '00000000-0000-0000-0000-000000000000',
          stripeInvoiceId: invoice.id!,
          status: 'paid',
          amountDue: invoice.amount_due,
          amountPaid: invoice.amount_paid,
          currency: invoice.currency,
          invoiceUrl: invoice.hosted_invoice_url ?? null,
          invoicePdf: invoice.invoice_pdf ?? null,
          periodStart: invoice.period_start ? new Date(invoice.period_start * 1000) : null,
          periodEnd: invoice.period_end ? new Date(invoice.period_end * 1000) : null,
        })
        .onConflictDoUpdate({
          target: invoices.stripeInvoiceId,
          set: {
            status: 'paid',
            amountPaid: invoice.amount_paid,
            invoiceUrl: invoice.hosted_invoice_url ?? null,
            invoicePdf: invoice.invoice_pdf ?? null,
          },
        });
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      const tenantId = (invoice.parent as any)?.subscription_details?.metadata?.tenantId
        || invoice.metadata?.tenantId;

      await db
        .insert(invoices)
        .values({
          tenantId: tenantId || '00000000-0000-0000-0000-000000000000',
          stripeInvoiceId: invoice.id!,
          status: 'open',
          amountDue: invoice.amount_due,
          amountPaid: 0,
          currency: invoice.currency,
          invoiceUrl: invoice.hosted_invoice_url ?? null,
          invoicePdf: invoice.invoice_pdf ?? null,
          periodStart: invoice.period_start ? new Date(invoice.period_start * 1000) : null,
          periodEnd: invoice.period_end ? new Date(invoice.period_end * 1000) : null,
        })
        .onConflictDoUpdate({
          target: invoices.stripeInvoiceId,
          set: {
            status: 'open',
            amountDue: invoice.amount_due,
          },
        });

      // Mark subscription as past_due if we can identify the tenant
      if (tenantId) {
        await db
          .update(subscriptions)
          .set({ status: 'past_due', updatedAt: new Date() })
          .where(eq(subscriptions.tenantId, tenantId));
        await invalidateBillingCache(tenantId);
      }
      break;
    }
  }
}
