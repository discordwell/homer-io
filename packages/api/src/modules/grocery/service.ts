import { eq } from 'drizzle-orm';
import { db } from '../../lib/db/index.js';
import { tenants } from '../../lib/db/schema/tenants.js';
import { logActivity } from '../../lib/activity.js';

export interface GrocerySettings {
  defaultSubstitutionPolicy: 'allow_all' | 'ask_first' | 'no_substitutions';
  temperatureMonitoring: boolean;
  defaultTemperatureZones: string[];
  deliveryBatchWindowMinutes: number;
}

const DEFAULTS: GrocerySettings = {
  defaultSubstitutionPolicy: 'ask_first',
  temperatureMonitoring: false,
  defaultTemperatureZones: ['ambient'],
  deliveryBatchWindowMinutes: 30,
};

export async function getGrocerySettings(tenantId: string): Promise<GrocerySettings> {
  const [row] = await db.select({ settings: tenants.settings })
    .from(tenants).where(eq(tenants.id, tenantId)).limit(1);

  const settings = (row?.settings ?? {}) as Record<string, unknown>;
  const grocery = settings.grocery as Partial<GrocerySettings> | undefined;
  if (!grocery) return { ...DEFAULTS };

  return {
    defaultSubstitutionPolicy: grocery.defaultSubstitutionPolicy ?? DEFAULTS.defaultSubstitutionPolicy,
    temperatureMonitoring: grocery.temperatureMonitoring ?? DEFAULTS.temperatureMonitoring,
    defaultTemperatureZones: grocery.defaultTemperatureZones ?? DEFAULTS.defaultTemperatureZones,
    deliveryBatchWindowMinutes: grocery.deliveryBatchWindowMinutes ?? DEFAULTS.deliveryBatchWindowMinutes,
  };
}

export async function updateGrocerySettings(
  tenantId: string,
  input: Partial<GrocerySettings>,
  userId?: string,
): Promise<GrocerySettings> {
  const [row] = await db.select({ settings: tenants.settings })
    .from(tenants).where(eq(tenants.id, tenantId)).limit(1);

  const settings = (row?.settings ?? {}) as Record<string, unknown>;
  const existing = (settings.grocery ?? {}) as Record<string, unknown>;
  const merged = { ...DEFAULTS, ...existing, ...input };

  await db.update(tenants).set({
    settings: { ...settings, grocery: merged },
    updatedAt: new Date(),
  }).where(eq(tenants.id, tenantId));

  if (userId) {
    await logActivity({
      tenantId,
      userId,
      action: 'update',
      entityType: 'grocery_settings',
      entityId: tenantId,
      metadata: input as Record<string, unknown>,
    });
  }

  return merged;
}
