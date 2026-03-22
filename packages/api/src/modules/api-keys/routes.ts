import { FastifyInstance } from 'fastify';
import { apiKeyCreateSchema } from '@homer-io/shared';
import { authenticate, requireRole } from '../../plugins/auth.js';
import { createApiKey, listApiKeys, revokeApiKey } from './service.js';

export async function apiKeyRoutes(app: FastifyInstance) {
  app.post('/', {
    preHandler: [authenticate, requireRole('admin')],
  }, async (request, reply) => {
    const body = apiKeyCreateSchema.parse(request.body);
    const result = await createApiKey(
      request.user.tenantId,
      request.user.id,
      body,
    );
    reply.code(201).send(result);
  });

  app.get('/', {
    preHandler: [authenticate, requireRole('admin')],
  }, async (request, reply) => {
    const keys = await listApiKeys(request.user.tenantId);
    reply.send(keys);
  });

  app.delete('/:id', {
    preHandler: [authenticate, requireRole('admin')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await revokeApiKey(
      request.user.tenantId,
      id,
      request.user.id,
    );
    reply.send(result);
  });
}
