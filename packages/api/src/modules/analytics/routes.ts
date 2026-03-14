import { FastifyInstance } from 'fastify';
import { analyticsQuerySchema } from '@homer-io/shared';
import { authenticate, requireRole } from '../../plugins/auth.js';
import {
  getAnalyticsOverview,
  getDriverPerformance,
  getRouteEfficiency,
  getTrends,
  exportAnalyticsCsv,
} from './service.js';

export async function analyticsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  app.get('/overview', { preHandler: [requireRole('dispatcher')] }, async (request) => {
    const { range } = analyticsQuerySchema.parse(request.query);
    return getAnalyticsOverview(request.user.tenantId, range);
  });

  app.get('/drivers', { preHandler: [requireRole('dispatcher')] }, async (request) => {
    const { range } = analyticsQuerySchema.parse(request.query);
    return getDriverPerformance(request.user.tenantId, range);
  });

  app.get('/routes', { preHandler: [requireRole('dispatcher')] }, async (request) => {
    const { range } = analyticsQuerySchema.parse(request.query);
    return getRouteEfficiency(request.user.tenantId, range);
  });

  app.get('/trends', { preHandler: [requireRole('dispatcher')] }, async (request) => {
    const { range } = analyticsQuerySchema.parse(request.query);
    return getTrends(request.user.tenantId, range);
  });

  app.get('/export/csv', { preHandler: [requireRole('admin')] }, async (request, reply) => {
    const { range } = analyticsQuerySchema.parse(request.query);
    const csv = await exportAnalyticsCsv(request.user.tenantId, range);
    reply
      .header('Content-Type', 'text/csv')
      .header('Content-Disposition', `attachment; filename="analytics-${range}.csv"`)
      .send(csv);
  });
}
