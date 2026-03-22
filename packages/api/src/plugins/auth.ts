import { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import { hasMinRole, type Role } from '@homer-io/shared';
import { db } from '../lib/db/index.js';
import { tenants } from '../lib/db/schema/tenants.js';
import { cacheGet, cacheSet } from '../lib/cache.js';

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

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch (err) {
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
