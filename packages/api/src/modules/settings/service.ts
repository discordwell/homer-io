import { eq } from 'drizzle-orm';
import type { UpdateOrgSettingsInput } from '@homer-io/shared';
import { db } from '../../lib/db/index.js';
import { tenants } from '../../lib/db/schema/tenants.js';
import { orgSettings } from '../../lib/db/schema/settings.js';
import { logActivity } from '../../lib/activity.js';

export async function getOrgSettings(tenantId: string) {
  const [existing] = await db
    .select()
    .from(orgSettings)
    .where(eq(orgSettings.tenantId, tenantId))
    .limit(1);

  // Fetch industry from tenants table
  const [tenant] = await db
    .select({ industry: tenants.industry })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  const settings = existing ?? (await db
    .insert(orgSettings)
    .values({ tenantId })
    .returning()
  )[0];

  return { ...settings, industry: tenant?.industry ?? null };
}

export async function updateOrgSettings(
  tenantId: string,
  input: UpdateOrgSettingsInput,
  userId?: string,
) {
  // Extract industry — it lives on tenants table, not org_settings
  const { industry, ...settingsInput } = input;

  if (industry) {
    await db.update(tenants).set({ industry, updatedAt: new Date() })
      .where(eq(tenants.id, tenantId));
  }

  // Upsert: try update first, insert if not exists
  const [existing] = await db
    .select({ id: orgSettings.id })
    .from(orgSettings)
    .where(eq(orgSettings.tenantId, tenantId))
    .limit(1);

  let result;

  if (existing) {
    const [updated] = await db
      .update(orgSettings)
      .set({
        ...settingsInput,
        updatedAt: new Date(),
      })
      .where(eq(orgSettings.tenantId, tenantId))
      .returning();
    result = updated;
  } else {
    const [created] = await db
      .insert(orgSettings)
      .values({
        tenantId,
        ...settingsInput,
      })
      .returning();
    result = created;
  }

  await logActivity({
    tenantId,
    userId,
    action: 'update',
    entityType: 'org_settings',
    entityId: result.id,
    metadata: input as Record<string, unknown>,
  });

  // Re-fetch industry to include in response
  const [tenant] = await db
    .select({ industry: tenants.industry })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  return { ...result, industry: tenant?.industry ?? null };
}
