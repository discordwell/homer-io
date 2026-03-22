import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { inviteUserSchema, ROLES } from '@homer-io/shared';
import { authenticate, requireRole, denyDemo } from '../../plugins/auth.js';
import { inviteUser, listTeamMembers, updateMemberRole, deactivateMember } from './service.js';

const updateRoleSchema = z.object({
  role: z.enum(ROLES),
});

export async function teamRoutes(app: FastifyInstance) {
  app.post('/invite', {
    preHandler: [authenticate, requireRole('admin'), denyDemo],
  }, async (request, reply) => {
    const body = inviteUserSchema.parse(request.body);
    const result = await inviteUser(
      request.user.tenantId,
      body,
      request.user.id,
    );
    reply.code(201).send(result);
  });

  app.get('/', {
    preHandler: [authenticate, requireRole('admin')],
  }, async (request, reply) => {
    const members = await listTeamMembers(request.user.tenantId);
    reply.send(members);
  });

  app.put('/:userId/role', {
    preHandler: [authenticate, requireRole('owner'), denyDemo],
  }, async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const { role } = updateRoleSchema.parse(request.body);
    const result = await updateMemberRole(
      request.user.tenantId,
      userId,
      role,
      request.user.id,
    );
    reply.send(result);
  });

  app.delete('/:userId', {
    preHandler: [authenticate, requireRole('admin'), denyDemo],
  }, async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const result = await deactivateMember(
      request.user.tenantId,
      userId,
      request.user.id,
    );
    reply.send(result);
  });
}
