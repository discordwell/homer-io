import { eq, sql } from 'drizzle-orm';
import { db } from '../../lib/db/index.js';
import { tenants } from '../../lib/db/schema/tenants.js';
import { vehicles } from '../../lib/db/schema/vehicles.js';
import { drivers } from '../../lib/db/schema/drivers.js';
import { orders } from '../../lib/db/schema/orders.js';
import { routes } from '../../lib/db/schema/routes.js';
import { notificationTemplates } from '../../lib/db/schema/notification-templates.js';
import type { OnboardingStatus } from '@homer-io/shared';

export async function getOnboardingStatus(tenantId: string): Promise<OnboardingStatus> {
  const [tenant] = await db.select({ onboardingCompletedAt: tenants.onboardingCompletedAt, isDemo: tenants.isDemo })
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

  // Count entities
  const [[v], [d], [o], [r], [n]] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(vehicles).where(eq(vehicles.tenantId, tenantId)),
    db.select({ count: sql<number>`count(*)` }).from(drivers).where(eq(drivers.tenantId, tenantId)),
    db.select({ count: sql<number>`count(*)` }).from(orders).where(eq(orders.tenantId, tenantId)),
    db.select({ count: sql<number>`count(*)` }).from(routes).where(eq(routes.tenantId, tenantId)),
    db.select({ count: sql<number>`count(*)` }).from(notificationTemplates).where(eq(notificationTemplates.tenantId, tenantId)),
  ]);

  const steps = [
    { key: 'vehicle', label: 'Add a vehicle', completed: Number(v.count) > 0 },
    { key: 'driver', label: 'Add a driver', completed: Number(d.count) > 0 },
    { key: 'order', label: 'Create an order', completed: Number(o.count) > 0 },
    { key: 'route', label: 'Plan a route', completed: Number(r.count) > 0 },
    { key: 'notification', label: 'Set up notifications', completed: Number(n.count) > 0 },
  ];

  const currentStep = steps.filter(s => s.completed).length;

  return { completed: false, currentStep, steps };
}

export async function completeOnboarding(tenantId: string): Promise<void> {
  await db.update(tenants).set({ onboardingCompletedAt: new Date(), updatedAt: new Date() })
    .where(eq(tenants.id, tenantId));
}

export async function skipOnboarding(tenantId: string): Promise<void> {
  await db.update(tenants).set({ onboardingCompletedAt: new Date(), updatedAt: new Date() })
    .where(eq(tenants.id, tenantId));
}
