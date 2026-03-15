import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, requireRole } from '../../plugins/auth.js';
import { getCurrentRoute, getUpcomingRoutes, updateDriverStatus, getDriverProfile } from './service.js';

const updateStatusSchema = z.object({
  status: z.enum(['available', 'offline', 'on_break']),
});

export async function driverRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  // GET /api/driver/current-route — get the driver's active in-progress route with stops
  app.get('/current-route', { preHandler: [requireRole('driver')] }, async (request) => {
    const { tenantId, id: userId } = request.user;
    return getCurrentRoute(tenantId, userId);
  });

  // GET /api/driver/upcoming-routes — get planned routes for this driver
  app.get('/upcoming-routes', { preHandler: [requireRole('driver')] }, async (request) => {
    const { tenantId, id: userId } = request.user;
    return getUpcomingRoutes(tenantId, userId);
  });

  // PATCH /api/driver/status — update driver availability status
  app.patch('/status', { preHandler: [requireRole('driver')] }, async (request) => {
    const { tenantId, id: userId } = request.user;
    const body = updateStatusSchema.parse(request.body);
    return updateDriverStatus(tenantId, userId, body.status);
  });

  // GET /api/driver/profile — get driver profile for the current user
  app.get('/profile', { preHandler: [requireRole('driver')] }, async (request) => {
    const { tenantId, id: userId } = request.user;
    return getDriverProfile(tenantId, userId);
  });
}
