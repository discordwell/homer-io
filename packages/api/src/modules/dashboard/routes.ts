import { FastifyInstance } from 'fastify';
import { authenticate } from '../../plugins/auth.js';
import { getDashboardStats } from './service.js';

export async function dashboardRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  app.get('/stats', async (request) => {
    return getDashboardStats(request.user.tenantId);
  });
}
