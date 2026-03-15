import type { FastifyInstance } from 'fastify';
import { authenticate, requireRole } from '../../plugins/auth.js';
import { getHealthStatus } from './service.js';

export async function adminHealthRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  app.get('/', { preHandler: [requireRole('admin')] }, async () => {
    return getHealthStatus();
  });
}
