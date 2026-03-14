import { FastifyRequest, FastifyReply } from 'fastify';
import { hasMinRole, type Role } from '@homer-io/shared';

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
