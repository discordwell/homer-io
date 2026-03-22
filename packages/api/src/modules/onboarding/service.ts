import { eq, sql } from 'drizzle-orm';
import { industrySchema } from '@homer-io/shared';
import type { Industry, OnboardingStatus } from '@homer-io/shared';
import { db } from '../../lib/db/index.js';
import { tenants } from '../../lib/db/schema/tenants.js';
import { vehicles } from '../../lib/db/schema/vehicles.js';
import { drivers } from '../../lib/db/schema/drivers.js';
import { orders } from '../../lib/db/schema/orders.js';
import { routes } from '../../lib/db/schema/routes.js';
import { notificationTemplates } from '../../lib/db/schema/notification-templates.js';
import { config } from '../../config.js';
import { generateIndustryOrders } from '../auth/industry-data.js';
import { BAY_AREA_LOCATIONS } from '../auth/demo-seed.js';

/** Per-tenant cooldown for sample data loading (60 seconds) */
const sampleDataCooldowns = new Map<string, number>();
const SAMPLE_DATA_COOLDOWN_MS = 60_000;

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
    industry: tenants.industry,
  })
    .from(tenants).where(eq(tenants.id, tenantId)).limit(1);

  if (tenant?.onboardingCompletedAt || tenant?.isDemo) {
    return {
      completed: true,
      currentStep: 6,
      steps: [
        { key: 'industry', label: 'Select your industry', completed: true },
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
    { key: 'industry', label: 'Select your industry', completed: !!tenant?.industry },
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

export async function setIndustry(tenantId: string, industry: Industry): Promise<{ success: boolean; industry: Industry; enabledFeatures: string[] }> {
  // Auto-populate default features for this industry
  const { getDefaultFeatures } = await import('@homer-io/shared');
  const enabledFeatures = getDefaultFeatures(industry);

  const [row] = await db.select({ settings: tenants.settings })
    .from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  const settings = (row?.settings ?? {}) as Record<string, unknown>;

  await db.update(tenants).set({
    industry,
    settings: { ...settings, enabledFeatures },
    updatedAt: new Date(),
  }).where(eq(tenants.id, tenantId));

  return { success: true, industry, enabledFeatures };
}

export async function loadSampleData(tenantId: string): Promise<{ success: boolean; ordersCreated: number; message?: string }> {
  // Rate limit: 1 call per 60 seconds per tenant
  const lastCall = sampleDataCooldowns.get(tenantId);
  if (lastCall && Date.now() - lastCall < SAMPLE_DATA_COOLDOWN_MS) {
    const waitSec = Math.ceil((SAMPLE_DATA_COOLDOWN_MS - (Date.now() - lastCall)) / 1000);
    return { success: false, ordersCreated: 0, message: `Please wait ${waitSec}s before loading more sample data` };
  }
  sampleDataCooldowns.set(tenantId, Date.now());

  const [tenant] = await db.select({ industry: tenants.industry })
    .from(tenants).where(eq(tenants.id, tenantId)).limit(1);

  const parsed = industrySchema.safeParse(tenant?.industry);
  const industry: Industry = parsed.success ? parsed.data : 'courier';
  const count = 15 + Math.floor(Math.random() * 6); // 15-20
  const orderData = generateIndustryOrders(industry, count, BAY_AREA_LOCATIONS);

  if (orderData.length === 0) {
    return { success: true, ordersCreated: 0 };
  }

  await db.insert(orders).values(
    orderData.map(o => ({
      tenantId,
      recipientName: o.recipientName,
      deliveryAddress: o.deliveryAddress,
      deliveryLat: o.deliveryLat,
      deliveryLng: o.deliveryLng,
      status: 'received' as const,
      createdAt: o.createdAt,
      notes: o.notes,
      requiresSignature: o.requiresSignature,
      requiresPhoto: o.requiresPhoto,
      serviceDurationMinutes: o.serviceDurationMinutes,
      priority: o.priority,
      packageCount: o.packageCount,
      weight: o.weight,
      customFields: o.customFields,
    })),
  );

  return { success: true, ordersCreated: orderData.length };
}
