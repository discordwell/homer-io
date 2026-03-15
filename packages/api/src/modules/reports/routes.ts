import { FastifyInstance } from 'fastify';
import { authenticate, requireRole } from '../../plugins/auth.js';
import {
  generateDailySummaryPDF,
  generateDriverPerformancePDF,
  generateRouteEfficiencyPDF,
} from './generator.js';

export async function reportRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  app.get(
    '/daily-summary',
    { preHandler: [requireRole('admin')] },
    async (request, reply) => {
      const { date } = request.query as { date?: string };
      const pdf = await generateDailySummaryPDF(request.user.tenantId, date);
      const filename = `daily-summary-${date || new Date().toISOString().split('T')[0]}.pdf`;

      reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .send(pdf);
    },
  );

  app.get(
    '/driver-performance',
    { preHandler: [requireRole('admin')] },
    async (request, reply) => {
      const { from, to } = request.query as { from?: string; to?: string };
      const pdf = await generateDriverPerformancePDF(request.user.tenantId, from, to);
      const filename = `driver-performance-${from || 'start'}-${to || 'now'}.pdf`;

      reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .send(pdf);
    },
  );

  app.get(
    '/route-efficiency',
    { preHandler: [requireRole('admin')] },
    async (request, reply) => {
      const { from, to } = request.query as { from?: string; to?: string };
      const pdf = await generateRouteEfficiencyPDF(request.user.tenantId, from, to);
      const filename = `route-efficiency-${from || 'start'}-${to || 'now'}.pdf`;

      reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .send(pdf);
    },
  );
}
