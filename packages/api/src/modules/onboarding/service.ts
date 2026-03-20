import { eq, sql } from 'drizzle-orm';
import { db } from '../../lib/db/index.js';
import { tenants } from '../../lib/db/schema/tenants.js';
import { vehicles } from '../../lib/db/schema/vehicles.js';
import { drivers } from '../../lib/db/schema/drivers.js';
import { orders } from '../../lib/db/schema/orders.js';
import { routes } from '../../lib/db/schema/routes.js';
import { notificationTemplates } from '../../lib/db/schema/notification-templates.js';
import { config } from '../../config.js';
import type { OnboardingStatus } from '@homer-io/shared';

/** Steps that can be skipped during onboarding (e.g. when providers are not configured) */
const SKIPPABLE_STEPS = new Set(['notification']);

/** Check whether notification providers (Twilio/SendGrid) are configured */
export function areNotificationProvidersConfigured(): { sms: boolean; email: boolean } {
  return {
    sms: !!(config.twilio.accountSid && config.twilio.authToken),
    email: !!config.sendgrid.apiKey,
  };
}

function getSkippedSteps(settings: Record<string, unknown>): string[] {
  const skipped = settings?.skippedOnboardingSteps;
  return Array.isArray(skipped) ? skipped : [];
}

export async function getOnboardingStatus(tenantId: string): Promise<OnboardingStatus> {
  const [tenant] = await db.select({
    onboardingCompletedAt: tenants.onboardingCompletedAt,
    isDemo: tenants.isDemo,
    settings: tenants.settings,
  })
    .from(tenants).where(eq(tenants.id, tenantId)).limit(1);

  if (tenant?.onboardingCompletedAt || tenant?.isDemo) {
    return {
      completed: true,
      currentStep: 5,
      steps: [
        { key: 'vehicle', label: 'Add a vehicle', completed: true },
        { key: 'driver', label: 'Add a driver', completed: true },
        { key: 'order', label: 'Create an order', completed: true },
        { key: 'route', label: 'Plan a route', completed: true },
        { key: 'notification', label: 'Set up notifications', completed: true },
      ],
    };
  }

  const skippedSteps = getSkippedSteps((tenant?.settings ?? {}) as Record<string, unknown>);
  const providers = areNotificationProvidersConfigured();

  // Count entities
  const [[v], [d], [o], [r], [n]] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(vehicles).where(eq(vehicles.tenantId, tenantId)),
    db.select({ count: sql<number>`count(*)` }).from(drivers).where(eq(drivers.tenantId, tenantId)),
    db.select({ count: sql<number>`count(*)` }).from(orders).where(eq(orders.tenantId, tenantId)),
    db.select({ count: sql<number>`count(*)` }).from(routes).where(eq(routes.tenantId, tenantId)),
    db.select({ count: sql<number>`count(*)` }).from(notificationTemplates).where(eq(notificationTemplates.tenantId, tenantId)),
  ]);

  const notificationSkipped = skippedSteps.includes('notification');
  const notificationCompleted = Number(n.count) > 0 || notificationSkipped;

  const steps = [
    { key: 'vehicle', label: 'Add a vehicle', completed: Number(v.count) > 0 },
    { key: 'driver', label: 'Add a driver', completed: Number(d.count) > 0 },
    { key: 'order', label: 'Create an order', completed: Number(o.count) > 0 },
    { key: 'route', label: 'Plan a route', completed: Number(r.count) > 0 },
    {
      key: 'notification',
      label: 'Set up notifications',
      completed: notificationCompleted,
      skippable: true,
      skipped: notificationSkipped,
      ...(!providers.sms && !providers.email
        ? { skipReason: 'Notification providers (Twilio/SendGrid) are not configured. You can set this up later in Settings.' }
        : {}),
    },
  ];

  const currentStep = steps.filter(s => s.completed).length;

  return { completed: false, currentStep, steps };
}

export async function skipStep(tenantId: string, stepKey: string): Promise<{ success: boolean; message: string }> {
  if (!SKIPPABLE_STEPS.has(stepKey)) {
    return { success: false, message: `Step "${stepKey}" cannot be skipped` };
  }

  const [tenant] = await db.select({ settings: tenants.settings })
    .from(tenants).where(eq(tenants.id, tenantId)).limit(1);

  const settings = (tenant?.settings ?? {}) as Record<string, unknown>;
  const skipped = getSkippedSteps(settings);

  if (!skipped.includes(stepKey)) {
    skipped.push(stepKey);
  }

  await db.update(tenants).set({
    settings: { ...settings, skippedOnboardingSteps: skipped },
    updatedAt: new Date(),
  }).where(eq(tenants.id, tenantId));

  return { success: true, message: `Step "${stepKey}" skipped. You can configure this later in Settings.` };
}

export async function completeOnboarding(tenantId: string): Promise<void> {
  await db.update(tenants).set({ onboardingCompletedAt: new Date(), updatedAt: new Date() })
    .where(eq(tenants.id, tenantId));
}

export async function skipOnboarding(tenantId: string): Promise<void> {
  await db.update(tenants).set({ onboardingCompletedAt: new Date(), updatedAt: new Date() })
    .where(eq(tenants.id, tenantId));
}
