import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, requireRole } from '../../plugins/auth.js';
import { getCurrentRoute, getUpcomingRoutes, updateDriverStatus, getDriverProfile } from './service.js';
import { createDriverInvite, redeemDriverInvite, listDriverInvites, validateInviteToken } from './invite-service.js';

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

  // ── Quick-Invite (temp driver onboarding) ──────────────────────────

  // POST /api/driver/quick-invite — generate invite link (dispatcher+)
  app.post('/quick-invite', { preHandler: [requireRole('dispatcher')] }, async (request) => {
    const body = z.object({ expiryDays: z.number().int().min(1).max(30).default(7) }).parse(request.body ?? {});
    return createDriverInvite(request.user.tenantId, request.user.id, body.expiryDays);
  });

  // GET /api/driver/invites — list invites (dispatcher+)
  app.get('/invites', { preHandler: [requireRole('dispatcher')] }, async (request) => {
    return listDriverInvites(request.user.tenantId);
  });

}

/** Public invite routes — no auth required (registered separately from driver routes) */
export async function driverInvitePublicRoutes(app: FastifyInstance) {
  // GET /api/driver/invite/:token — validate invite token
  app.get('/:token', async (request) => {
    const { token } = request.params as { token: string };
    return validateInviteToken(token);
  });

  // POST /api/driver/invite/:token/redeem — redeem invite
  app.post('/:token/redeem', async (request) => {
    const { token } = request.params as { token: string };
    const body = z.object({
      name: z.string().min(1).max(255),
      phone: z.string().min(1).max(20),
    }).parse(request.body);
    return redeemDriverInvite(token, body);
  });
}
