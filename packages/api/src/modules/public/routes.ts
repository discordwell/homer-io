import { FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { getPublicTracking } from './service.js';

export async function publicRoutes(app: FastifyInstance) {
  // Tighter rate limit for public tracking — 30 requests/min per IP
  await app.register(rateLimit, { max: 30, timeWindow: '1 minute' });

  // GET /api/public/track/:orderId — public tracking, no auth
  app.get('/track/:orderId', async (request, reply) => {
    const { orderId } = request.params as { orderId: string };

    // Basic UUID format validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(orderId)) {
      return reply.badRequest('Invalid order ID format');
    }

    const tracking = await getPublicTracking(orderId);
    return tracking;
  });
}
