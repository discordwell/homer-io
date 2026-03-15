import { FastifyInstance } from 'fastify';
import { analyticsQuerySchema } from '@homer-io/shared';
import { authenticate, requireRole } from '../../plugins/auth.js';
import { getCarbonOverview, getCarbonByDriver } from './service.js';

export async function carbonRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  // GET /api/analytics/carbon?range=7d|30d|90d — carbon overview + per-driver breakdown
  app.get('/carbon', { preHandler: [requireRole('dispatcher')] }, async (request) => {
    const { range } = analyticsQuerySchema.parse(request.query);
    const [overview, driverBreakdown] = await Promise.all([
      getCarbonOverview(request.user.tenantId, range),
      getCarbonByDriver(request.user.tenantId, range),
    ]);
    return { overview, drivers: driverBreakdown };
  });
}
