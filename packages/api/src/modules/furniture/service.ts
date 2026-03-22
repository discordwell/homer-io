import { eq } from 'drizzle-orm';
import { db } from '../../lib/db/index.js';
import { tenants } from '../../lib/db/schema/tenants.js';
import { logActivity } from '../../lib/activity.js';

export interface FurnitureSettings {
  defaultCrewSize: number;
  assemblyService: boolean;
  haulAwayService: boolean;
  defaultTimeWindowHours: number;
  whiteGloveChecklist: boolean;
}

const DEFAULTS: FurnitureSettings = {
  defaultCrewSize: 2,
  assemblyService: false,
  haulAwayService: false,
  defaultTimeWindowHours: 3,
  whiteGloveChecklist: false,
};

export async function getFurnitureSettings(tenantId: string): Promise<FurnitureSettings> {
  const [row] = await db.select({ settings: tenants.settings })
    .from(tenants).where(eq(tenants.id, tenantId)).limit(1);

  const settings = (row?.settings ?? {}) as Record<string, unknown>;
  const furniture = settings.furniture as Partial<FurnitureSettings> | undefined;
  if (!furniture) return { ...DEFAULTS };

  return {
    defaultCrewSize: furniture.defaultCrewSize ?? DEFAULTS.defaultCrewSize,
    assemblyService: furniture.assemblyService ?? DEFAULTS.assemblyService,
    haulAwayService: furniture.haulAwayService ?? DEFAULTS.haulAwayService,
    defaultTimeWindowHours: furniture.defaultTimeWindowHours ?? DEFAULTS.defaultTimeWindowHours,
    whiteGloveChecklist: furniture.whiteGloveChecklist ?? DEFAULTS.whiteGloveChecklist,
  };
}

export async function updateFurnitureSettings(
  tenantId: string,
  input: Partial<FurnitureSettings>,
  userId?: string,
): Promise<FurnitureSettings> {
  const [row] = await db.select({ settings: tenants.settings })
    .from(tenants).where(eq(tenants.id, tenantId)).limit(1);

  const settings = (row?.settings ?? {}) as Record<string, unknown>;
  const existing = (settings.furniture ?? {}) as Record<string, unknown>;
  const merged = { ...DEFAULTS, ...existing, ...input };

  await db.update(tenants).set({
    settings: { ...settings, furniture: merged },
    updatedAt: new Date(),
  }).where(eq(tenants.id, tenantId));

  if (userId) {
    await logActivity({
      tenantId,
      userId,
      action: 'update',
      entityType: 'furniture_settings',
      entityId: tenantId,
      metadata: input as Record<string, unknown>,
    });
  }

  return merged;
}
