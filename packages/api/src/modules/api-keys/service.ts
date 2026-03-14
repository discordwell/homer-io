import { eq, and } from 'drizzle-orm';
import { randomBytes, createHash } from 'crypto';
import type { ApiKeyCreateInput } from '@homer-io/shared';
import { db } from '../../lib/db/index.js';
import { apiKeys } from '../../lib/db/schema/api-keys.js';
import { HttpError } from '../../lib/errors.js';
import { logActivity } from '../../lib/activity.js';

function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

export async function createApiKey(
  tenantId: string,
  userId: string,
  input: ApiKeyCreateInput,
) {
  // Generate a random API key
  const rawKey = `hio_${randomBytes(32).toString('base64url')}`;
  const keyHash = hashKey(rawKey);
  const keyPrefix = rawKey.slice(0, 8);

  const [created] = await db
    .insert(apiKeys)
    .values({
      tenantId,
      createdBy: userId,
      name: input.name,
      keyHash,
      keyPrefix,
      scopes: input.scopes,
    })
    .returning({
      id: apiKeys.id,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      scopes: apiKeys.scopes,
      createdAt: apiKeys.createdAt,
    });

  await logActivity({
    tenantId,
    userId,
    action: 'create',
    entityType: 'api_key',
    entityId: created.id,
    metadata: { name: input.name, scopes: input.scopes },
  });

  return {
    ...created,
    key: rawKey, // Only returned once, never stored in plain text
    createdAt: created.createdAt.toISOString(),
  };
}

export async function listApiKeys(tenantId: string) {
  const keys = await db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      scopes: apiKeys.scopes,
      lastUsedAt: apiKeys.lastUsedAt,
      expiresAt: apiKeys.expiresAt,
      createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.tenantId, tenantId));

  return keys.map(k => ({
    ...k,
    lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
    expiresAt: k.expiresAt?.toISOString() ?? null,
    createdAt: k.createdAt.toISOString(),
  }));
}

export async function revokeApiKey(
  tenantId: string,
  keyId: string,
  userId?: string,
) {
  const [existing] = await db
    .select({ id: apiKeys.id, name: apiKeys.name })
    .from(apiKeys)
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.tenantId, tenantId)))
    .limit(1);

  if (!existing) {
    throw new HttpError(404, 'API key not found');
  }

  await db
    .delete(apiKeys)
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.tenantId, tenantId)));

  await logActivity({
    tenantId,
    userId,
    action: 'revoke',
    entityType: 'api_key',
    entityId: keyId,
    metadata: { name: existing.name },
  });

  return { success: true };
}
