import { eq } from 'drizzle-orm';
import type { UpdateOrgSettingsInput } from '@homer-io/shared';
import { db } from '../../lib/db/index.js';
import { orgSettings } from '../../lib/db/schema/settings.js';
import { logActivity } from '../../lib/activity.js';

export async function getOrgSettings(tenantId: string) {
  const [existing] = await db
    .select()
    .from(orgSettings)
    .where(eq(orgSettings.tenantId, tenantId))
    .limit(1);

  if (existing) {
    return existing;
  }

  // Create default settings
  const [created] = await db
    .insert(orgSettings)
    .values({ tenantId })
    .returning();

  return created;
}

export async function updateOrgSettings(
  tenantId: string,
  input: UpdateOrgSettingsInput,
  userId?: string,
) {
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
        ...input,
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
        ...input,
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

  return result;
}
