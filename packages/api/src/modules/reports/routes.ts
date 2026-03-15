import { z } from 'zod';
import { FastifyInstance } from 'fastify';
import { authenticate, requireRole } from '../../plugins/auth.js';
import {
  generateDailySummaryPDF,
  generateDriverPerformancePDF,
  generateRouteEfficiencyPDF,
} from './generator.js';

// Date validation: YYYY-MM-DD format, must be a real date
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').refine(
  (s) => !isNaN(new Date(`${s}T00:00:00Z`).getTime()),
  'Invalid date',
);

const dailySummaryQuerySchema = z.object({
  date: dateString.optional(),
});

const dateRangeQuerySchema = z.object({
  from: dateString.optional(),
  to: dateString.optional(),
});

export async function reportRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  app.get(
    '/daily-summary',
    { preHandler: [requireRole('admin')] },
    async (request, reply) => {
      const { date } = dailySummaryQuerySchema.parse(request.query);
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
      const { from, to } = dateRangeQuerySchema.parse(request.query);
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
      const { from, to } = dateRangeQuerySchema.parse(request.query);
      const pdf = await generateRouteEfficiencyPDF(request.user.tenantId, from, to);
      const filename = `route-efficiency-${from || 'start'}-${to || 'now'}.pdf`;

      reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .send(pdf);
    },
  );
}
