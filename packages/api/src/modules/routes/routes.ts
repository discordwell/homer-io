import { FastifyInstance } from 'fastify';
import { paginationSchema, createRouteSchema } from '@homer-io/shared';
import { authenticate, requireRole } from '../../plugins/auth.js';
import { createRoute, listRoutes, getRoute, updateRoute, deleteRoute, optimizeRoute } from './service.js';

export async function routeRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  app.post('/', { preHandler: [requireRole('dispatcher')] }, async (request, reply) => {
    const body = createRouteSchema.parse(request.body);
    const route = await createRoute(request.user.tenantId, body);
    reply.code(201).send(route);
  });

  app.get('/', async (request) => {
    const query = paginationSchema.parse(request.query);
    const { status } = request.query as { status?: string };
    return listRoutes(request.user.tenantId, query, status);
  });

  app.get('/:id', async (request) => {
    const { id } = request.params as { id: string };
    return getRoute(request.user.tenantId, id);
  });

  app.patch('/:id', { preHandler: [requireRole('dispatcher')] }, async (request) => {
    const { id } = request.params as { id: string };
    const body = createRouteSchema.partial().parse(request.body);
    return updateRoute(request.user.tenantId, id, body);
  });

  app.delete('/:id', { preHandler: [requireRole('admin')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await deleteRoute(request.user.tenantId, id);
    reply.code(204).send();
  });

  app.post('/:id/optimize', { preHandler: [requireRole('dispatcher')] }, async (request) => {
    const { id } = request.params as { id: string };
    return optimizeRoute(request.user.tenantId, id);
  });
}
