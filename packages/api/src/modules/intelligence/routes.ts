import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, requireRole } from '../../plugins/auth.js';
import { getAddressIntelligence, getRouteRisk, getInsights } from './service.js';

const addressHashParam = z.object({
  hash: z.string().regex(/^[0-9a-f]{64}$/, 'Invalid address hash'),
});

const routeIdParam = z.object({
  routeId: z.string().uuid('Invalid route ID'),
});

export async function intelligenceRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  // GET /api/intelligence/address/:hash — address history + delivery metrics
  app.get('/address/:hash', {
    preHandler: [requireRole('dispatcher')],
  }, async (request) => {
    const { hash } = addressHashParam.parse(request.params);
    return getAddressIntelligence(request.user.tenantId, hash);
  });

  // GET /api/intelligence/risk/:routeId — risk scores for route stops
  app.get('/risk/:routeId', {
    preHandler: [requireRole('dispatcher')],
  }, async (request) => {
    const { routeId } = routeIdParam.parse(request.params);
    return getRouteRisk(request.user.tenantId, routeId);
  });

  // GET /api/intelligence/insights — dashboard-level learnings
  app.get('/insights', {
    preHandler: [requireRole('dispatcher')],
  }, async (request) => {
    return getInsights(request.user.tenantId);
  });
}
