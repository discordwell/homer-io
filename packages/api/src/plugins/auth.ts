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
    reply.unauthorized('Invalid or expired token');
  }
}

export function requireRole(minRole: Role) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    await authenticate(request, reply);
    if (!hasMinRole(request.user.role, minRole)) {
      reply.forbidden(`Requires ${minRole} role or higher`);
    }
  };
}
