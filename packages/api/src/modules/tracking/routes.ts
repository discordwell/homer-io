import { FastifyInstance } from 'fastify';
import { locationUpdateSchema } from '@homer-io/shared';
import { authenticate, requireRole } from '../../plugins/auth.js';
import {
  updateDriverLocation,
  getActiveDriverLocations,
  getRouteProgress,
  findDriverByUserId,
} from './service.js';

export async function trackingRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  // POST /api/tracking/location — driver sends their position
  app.post('/location', { preHandler: [requireRole('driver')] }, async (request, reply) => {
    const location = locationUpdateSchema.parse(request.body);
    const { tenantId, id: userId } = request.user;

    const driverId = await findDriverByUserId(tenantId, userId);
    if (!driverId) {
      return reply.badRequest('No driver profile linked to this user');
    }

    await updateDriverLocation(tenantId, driverId, location);
    return { success: true };
  });

  // GET /api/tracking/drivers — dispatcher gets all active driver locations
  app.get('/drivers', { preHandler: [requireRole('dispatcher')] }, async (request) => {
    return getActiveDriverLocations(request.user.tenantId);
  });

  // GET /api/tracking/route/:routeId/progress — get route completion progress
  app.get('/route/:routeId/progress', async (request) => {
    const { routeId } = request.params as { routeId: string };
    return getRouteProgress(request.user.tenantId, routeId);
  });
}
