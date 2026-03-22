import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { authenticate, requireRole } from '../../plugins/auth.js';
import { db } from '../../lib/db/index.js';
import { tenants } from '../../lib/db/schema/tenants.js';
import { getGrocerySettings, updateGrocerySettings } from './service.js';

const updateGrocerySettingsSchema = z.object({
  defaultSubstitutionPolicy: z.enum(['allow_all', 'ask_first', 'no_substitutions']).optional(),
  temperatureMonitoring: z.boolean().optional(),
  defaultTemperatureZones: z.array(z.enum(['frozen', 'refrigerated', 'ambient'])).optional(),
  deliveryBatchWindowMinutes: z.number().int().min(5).max(240).optional(),
});

// Industry gate -- reusable preHandler
async function requireGrocery(request: FastifyRequest, reply: FastifyReply) {
  const [row] = await db.select({ industry: tenants.industry })
    .from(tenants).where(eq(tenants.id, request.user.tenantId)).limit(1);
  if (row?.industry !== 'grocery') {
    return reply.forbidden('This feature requires the grocery industry');
  }
}

export async function groceryRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);
  app.addHook('preHandler', requireGrocery);

  // -- Settings --

  app.get('/settings', { preHandler: [requireRole('admin')] }, async (request) => {
    return getGrocerySettings(request.user.tenantId);
  });

  app.put('/settings', { preHandler: [requireRole('owner')] }, async (request) => {
    const body = updateGrocerySettingsSchema.parse(request.body);
    return updateGrocerySettings(request.user.tenantId, body, request.user.id);
  });
}
