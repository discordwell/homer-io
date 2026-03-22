import { eq } from 'drizzle-orm';
import { db } from '../../lib/db/index.js';
import { tenants } from '../../lib/db/schema/tenants.js';
import { logActivity } from '../../lib/activity.js';

export interface RestaurantSettings {
  defaultDeliveryWindowMinutes: number;
  speedPriority: boolean;
  defaultOrderBatchSize: number;
}

const DEFAULTS: RestaurantSettings = {
  defaultDeliveryWindowMinutes: 30,
  speedPriority: false,
  defaultOrderBatchSize: 5,
};

export async function getRestaurantSettings(tenantId: string): Promise<RestaurantSettings> {
  const [row] = await db.select({ settings: tenants.settings })
    .from(tenants).where(eq(tenants.id, tenantId)).limit(1);

  const settings = (row?.settings ?? {}) as Record<string, unknown>;
  const restaurant = settings.restaurant as Partial<RestaurantSettings> | undefined;
  if (!restaurant) return { ...DEFAULTS };

  return {
    defaultDeliveryWindowMinutes: restaurant.defaultDeliveryWindowMinutes ?? DEFAULTS.defaultDeliveryWindowMinutes,
    speedPriority: restaurant.speedPriority ?? DEFAULTS.speedPriority,
    defaultOrderBatchSize: restaurant.defaultOrderBatchSize ?? DEFAULTS.defaultOrderBatchSize,
  };
}

export async function updateRestaurantSettings(
  tenantId: string,
  input: Partial<RestaurantSettings>,
  userId?: string,
): Promise<RestaurantSettings> {
  const [row] = await db.select({ settings: tenants.settings })
    .from(tenants).where(eq(tenants.id, tenantId)).limit(1);

  const settings = (row?.settings ?? {}) as Record<string, unknown>;
  const existing = (settings.restaurant ?? {}) as Record<string, unknown>;
  const merged = { ...DEFAULTS, ...existing, ...input };

  await db.update(tenants).set({
    settings: { ...settings, restaurant: merged },
    updatedAt: new Date(),
  }).where(eq(tenants.id, tenantId));

  if (userId) {
    await logActivity({
      tenantId,
      userId,
      action: 'update',
      entityType: 'restaurant_settings',
      entityId: tenantId,
      metadata: input as Record<string, unknown>,
    });
  }

  return merged;
}
