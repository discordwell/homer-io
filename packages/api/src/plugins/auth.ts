import { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import { createHash } from 'crypto';
import { hasMinRole, type Role } from '@homer-io/shared';
import { db } from '../lib/db/index.js';
import { tenants } from '../lib/db/schema/tenants.js';
import { apiKeys } from '../lib/db/schema/api-keys.js';
import { users } from '../lib/db/schema/users.js';
import { cacheGet, cacheSet } from '../lib/cache.js';
import { logger } from '../lib/logger.js';

export interface JwtPayload {
  id: string;
  tenantId: string;
  email: string;
  role: Role;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}

/** Authenticate via JWT token or API key (hio_ prefix) */
export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;

  // API key auth: Bearer hio_...
  if (authHeader?.startsWith('Bearer hio_')) {
    const rawKey = authHeader.slice(7);
    const keyHash = createHash('sha256').update(rawKey).digest('hex');

    const [key] = await db.select({
      id: apiKeys.id,
      tenantId: apiKeys.tenantId,
      createdBy: apiKeys.createdBy,
      expiresAt: apiKeys.expiresAt,
    })
      .from(apiKeys)
      .where(eq(apiKeys.keyHash, keyHash))
      .limit(1);

    if (!key) return reply.unauthorized('Invalid API key');
    if (key.expiresAt && new Date() > key.expiresAt) return reply.unauthorized('API key has expired');

    const [user] = await db.select({ id: users.id, email: users.email, role: users.role })
      .from(users).where(eq(users.id, key.createdBy)).limit(1);

    if (!user) return reply.unauthorized('API key owner not found');

    (request as any).user = {
      id: user.id,
      tenantId: key.tenantId,
      email: user.email,
      role: user.role,
    };

    // Update lastUsedAt (fire-and-forget) — non-load-bearing observability field.
    // If the DB write fails we still want the request to succeed, but the failure
    // should be logged so a Redis/DB blip doesn't disappear silently.
    db.update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, key.id))
      .catch((err: unknown) =>
        logger.warn({ err, keyId: key.id, tenantId: key.tenantId }, '[auth] Failed to update API key lastUsedAt'),
      );
    return;
  }

  // JWT auth (default)
  try {
    await request.jwtVerify();
  } catch {
    return reply.unauthorized('Invalid or expired token');
  }
}

export function requireRole(minRole: Role) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.unauthorized('Not authenticated');
    }
    if (!hasMinRole(request.user.role, minRole)) {
      return reply.forbidden(`Requires ${minRole} role or higher`);
    }
  };
}

/** Check if tenant is a demo tenant (cached 60s) */
export async function checkIsDemo(tenantId: string): Promise<boolean> {
  const cacheKey = `tenant:isDemo:${tenantId}`;
  const cached = await cacheGet<boolean>(cacheKey);
  if (cached !== null) return cached;

  const [row] = await db
    .select({ isDemo: tenants.isDemo })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  const isDemo = row?.isDemo ?? false;
  await cacheSet(cacheKey, isDemo, 60);
  return isDemo;
}

/** PreHandler: block demo tenants from sensitive write operations */
export async function denyDemo(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user?.tenantId) return;
  const isDemo = await checkIsDemo(request.user.tenantId);
  if (isDemo) {
    return reply.forbidden('This action is not available in demo mode');
  }
}
