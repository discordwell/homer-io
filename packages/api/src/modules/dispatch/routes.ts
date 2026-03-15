import { FastifyInstance } from 'fastify';
import { autoDispatchRequestSchema, confirmDispatchSchema } from '@homer-io/shared';
import { authenticate, requireRole } from '../../plugins/auth.js';
import { autoDispatch, confirmDispatch } from './service.js';

export async function dispatchRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  // POST /api/dispatch/auto-dispatch — run AI auto-dispatch to generate a preview
  app.post('/auto-dispatch', { preHandler: [requireRole('dispatcher')] }, async (request, reply) => {
    const body = autoDispatchRequestSchema.parse(request.body);
    const result = await autoDispatch(request.user.tenantId, body, request.user.id);
    reply.send(result);
  });

  // POST /api/dispatch/auto-dispatch/confirm — confirm selected routes from preview
  app.post('/auto-dispatch/confirm', { preHandler: [requireRole('dispatcher')] }, async (request, reply) => {
    const body = confirmDispatchSchema.parse(request.body);
    const results = await confirmDispatch(request.user.tenantId, body.routeIds, request.user.id);
    reply.send({ routes: results, confirmed: body.routeIds.length });
  });
}
