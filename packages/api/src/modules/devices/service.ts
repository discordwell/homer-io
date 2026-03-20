import { eq, and } from 'drizzle-orm';
import { db } from '../../lib/db/index.js';
import { deviceTokens } from '../../lib/db/schema/index.js';

export async function registerDevice(
  userId: string,
  tenantId: string,
  token: string,
  platform: string,
): Promise<void> {
  // Upsert — if token already exists (e.g. re-register on app launch), update it
  await db
    .insert(deviceTokens)
    .values({ userId, tenantId, token, platform })
    .onConflictDoUpdate({
      target: deviceTokens.token,
      set: { userId, tenantId, platform, updatedAt: new Date() },
    });
}

export async function unregisterDevice(userId: string): Promise<void> {
  await db.delete(deviceTokens).where(eq(deviceTokens.userId, userId));
}

export async function getDeviceTokensForUser(userId: string): Promise<string[]> {
  const rows = await db
    .select({ token: deviceTokens.token })
    .from(deviceTokens)
    .where(eq(deviceTokens.userId, userId));
  return rows.map((r) => r.token);
}
