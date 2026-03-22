import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { authenticate, requireRole } from '../../plugins/auth.js';
import { db } from '../../lib/db/index.js';
import { tenants } from '../../lib/db/schema/tenants.js';
import { getRestaurantSettings, updateRestaurantSettings } from './service.js';

const updateRestaurantSettingsSchema = z.object({
  defaultDeliveryWindowMinutes: z.number().int().min(5).max(240).optional(),
  speedPriority: z.boolean().optional(),
  defaultOrderBatchSize: z.number().int().min(1).max(50).optional(),
});

// Industry gate — reusable preHandler
async function requireRestaurant(request: FastifyRequest, reply: FastifyReply) {
  const [row] = await db.select({ industry: tenants.industry })
    .from(tenants).where(eq(tenants.id, request.user.tenantId)).limit(1);
  if (row?.industry !== 'restaurant') {
    return reply.forbidden('This feature requires the restaurant industry');
  }
}

export async function restaurantRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);
  app.addHook('preHandler', requireRestaurant);

  // -- Settings --

  app.get('/settings', { preHandler: [requireRole('admin')] }, async (request) => {
    return getRestaurantSettings(request.user.tenantId);
  });

  app.put('/settings', { preHandler: [requireRole('owner')] }, async (request) => {
    const body = updateRestaurantSettingsSchema.parse(request.body);
    return updateRestaurantSettings(request.user.tenantId, body, request.user.id);
  });
}
