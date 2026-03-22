import { eq } from 'drizzle-orm';
import { db } from '../../lib/db/index.js';
import { tenants } from '../../lib/db/schema/tenants.js';
import { logActivity } from '../../lib/activity.js';

export interface FloristSettings {
  autoRequirePhoto: boolean;
  defaultGiftDelivery: boolean;
  defaultGiftMessage: string;
  defaultDeliveryInstructions: string;
}

const DEFAULTS: FloristSettings = {
  autoRequirePhoto: true,
  defaultGiftDelivery: false,
  defaultGiftMessage: '',
  defaultDeliveryInstructions: '',
};

export async function getFloristSettings(tenantId: string): Promise<FloristSettings> {
  const [row] = await db.select({ settings: tenants.settings })
    .from(tenants).where(eq(tenants.id, tenantId)).limit(1);

  const settings = (row?.settings ?? {}) as Record<string, unknown>;
  const florist = settings.florist as Partial<FloristSettings> | undefined;
  if (!florist) return { ...DEFAULTS };

  return {
    autoRequirePhoto: florist.autoRequirePhoto ?? DEFAULTS.autoRequirePhoto,
    defaultGiftDelivery: florist.defaultGiftDelivery ?? DEFAULTS.defaultGiftDelivery,
    defaultGiftMessage: florist.defaultGiftMessage ?? DEFAULTS.defaultGiftMessage,
    defaultDeliveryInstructions: florist.defaultDeliveryInstructions ?? DEFAULTS.defaultDeliveryInstructions,
  };
}

export async function updateFloristSettings(
  tenantId: string,
  input: Partial<FloristSettings>,
  userId?: string,
): Promise<FloristSettings> {
  const [row] = await db.select({ settings: tenants.settings })
    .from(tenants).where(eq(tenants.id, tenantId)).limit(1);

  const settings = (row?.settings ?? {}) as Record<string, unknown>;
  const existing = (settings.florist ?? {}) as Record<string, unknown>;
  const merged = { ...DEFAULTS, ...existing, ...input };

  await db.update(tenants).set({
    settings: { ...settings, florist: merged },
    updatedAt: new Date(),
  }).where(eq(tenants.id, tenantId));

  if (userId) {
    await logActivity({
      tenantId,
      userId,
      action: 'update',
      entityType: 'florist_settings',
      entityId: tenantId,
      metadata: input as Record<string, unknown>,
    });
  }

  return merged;
}
