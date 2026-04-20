import { eq } from 'drizzle-orm';
import type { PharmacySettings, UpdatePharmacySettingsInput } from '@homer-io/shared';
import { pharmacySettingsSchema } from '@homer-io/shared';
import { db } from '../../lib/db/index.js';
import { tenants } from '../../lib/db/schema/tenants.js';
import { logActivity } from '../../lib/activity.js';
import { HttpError } from '../../lib/errors.js';

export async function getPharmacySettings(tenantId: string): Promise<PharmacySettings | null> {
  const [row] = await db.select({ settings: tenants.settings })
    .from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  const settings = (row?.settings ?? {}) as Record<string, unknown>;
  const pharmacy = settings.pharmacy;
  if (!pharmacy) return null;
  const parsed = pharmacySettingsSchema.safeParse(pharmacy);
  return parsed.success ? parsed.data : null;
}

export async function updatePharmacySettings(
  tenantId: string,
  input: UpdatePharmacySettingsInput,
  userId?: string,
): Promise<PharmacySettings> {
  const [row] = await db.select({ settings: tenants.settings })
    .from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  const settings = (row?.settings ?? {}) as Record<string, unknown>;
  const existing = (settings.pharmacy ?? {}) as Record<string, unknown>;
  const merged = { ...existing, ...input };

  await db.update(tenants).set({
    settings: { ...settings, pharmacy: merged },
    updatedAt: new Date(),
  }).where(eq(tenants.id, tenantId));

  if (userId) {
    await logActivity({
      tenantId, userId, action: 'update',
      entityType: 'pharmacy_settings', entityId: tenantId,
      metadata: { ...input, retentionYears: 10 } as Record<string, unknown>,
    });
  }

  return pharmacySettingsSchema.parse(merged);
}

export async function requirePharmacyIndustry(tenantId: string): Promise<void> {
  const [row] = await db.select({ industry: tenants.industry })
    .from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  if (row?.industry !== 'pharmacy') {
    throw new HttpError(403, 'This feature requires the pharmacy industry');
  }
}
