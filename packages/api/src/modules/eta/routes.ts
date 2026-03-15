import { FastifyInstance } from 'fastify';
import { authenticate } from '../../plugins/auth.js';
import { calculateRouteETAs } from './service.js';

export async function etaRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  // GET /api/routes/:id/eta — calculate ETAs for a route
  app.get('/routes/:id/eta', async (request) => {
    const { id } = request.params as { id: string };
    return calculateRouteETAs(id, request.user.tenantId);
  });

  // GET /api/tracking/route/:routeId/eta — public-ish ETA endpoint (still authenticated for now)
  app.get('/tracking/route/:routeId/eta', async (request) => {
    const { routeId } = request.params as { routeId: string };
    return calculateRouteETAs(routeId, request.user.tenantId);
  });
}
