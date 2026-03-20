import { FastifyInstance } from 'fastify';
import { analyticsQuerySchema } from '@homer-io/shared';
import { authenticate, requireRole } from '../../plugins/auth.js';
import {
  getAnalyticsOverview,
  getDriverPerformance,
  getRouteEfficiency,
  getTrends,
  exportAnalyticsCsv,
  getEnhancedOverview,
  getEnhancedTrends,
  getHeatmapData,
  generateInsights,
  getDeliveryOutcomes,
  getEnhancedDriverPerformance,
  getEnhancedRouteEfficiency,
  comparePeriods,
} from './service.js';

export async function analyticsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  // Original endpoints (kept for backward compat)
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

  // Enhanced endpoints for the new analytics page
  app.get('/enhanced/overview', { preHandler: [requireRole('dispatcher')] }, async (request) => {
    const { range } = analyticsQuerySchema.parse(request.query);
    return getEnhancedOverview(request.user.tenantId, range);
  });

  app.get('/enhanced/trends', { preHandler: [requireRole('dispatcher')] }, async (request) => {
    const { range } = analyticsQuerySchema.parse(request.query);
    return getEnhancedTrends(request.user.tenantId, range);
  });

  app.get('/enhanced/drivers', { preHandler: [requireRole('dispatcher')] }, async (request) => {
    const { range } = analyticsQuerySchema.parse(request.query);
    return getEnhancedDriverPerformance(request.user.tenantId, range);
  });

  app.get('/enhanced/routes', { preHandler: [requireRole('dispatcher')] }, async (request) => {
    const { range } = analyticsQuerySchema.parse(request.query);
    return getEnhancedRouteEfficiency(request.user.tenantId, range);
  });

  app.get('/heatmap', { preHandler: [requireRole('dispatcher')] }, async (request) => {
    const { range } = analyticsQuerySchema.parse(request.query);
    return getHeatmapData(request.user.tenantId, range);
  });

  app.get('/insights', { preHandler: [requireRole('dispatcher')] }, async (request) => {
    const { range } = analyticsQuerySchema.parse(request.query);
    return generateInsights(request.user.tenantId, range);
  });

  app.get('/outcomes', { preHandler: [requireRole('dispatcher')] }, async (request) => {
    const { range } = analyticsQuerySchema.parse(request.query);
    return getDeliveryOutcomes(request.user.tenantId, range);
  });

  app.get('/compare', { preHandler: [requireRole('dispatcher')] }, async (request) => {
    const { range } = analyticsQuerySchema.parse(request.query);
    return comparePeriods(request.user.tenantId, range);
  });
}
