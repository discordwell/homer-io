import type { FastifyInstance } from 'fastify';
import { authenticate, requireRole } from '../../plugins/auth.js';
import { getAddressIntelligence, getRouteRisk, getInsights } from './service.js';

export async function intelligenceRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  // GET /api/intelligence/address/:hash — address history + delivery metrics
  app.get('/address/:hash', {
    preHandler: [requireRole('dispatcher')],
  }, async (request) => {
    const { hash } = request.params as { hash: string };
    return getAddressIntelligence(request.user.tenantId, hash);
  });

  // GET /api/intelligence/risk/:routeId — risk scores for route stops
  app.get('/risk/:routeId', {
    preHandler: [requireRole('dispatcher')],
  }, async (request) => {
    const { routeId } = request.params as { routeId: string };
    return getRouteRisk(request.user.tenantId, routeId);
  });

  // GET /api/intelligence/insights — dashboard-level learnings
  app.get('/insights', {
    preHandler: [requireRole('dispatcher')],
  }, async (request) => {
    return getInsights(request.user.tenantId);
  });
}
