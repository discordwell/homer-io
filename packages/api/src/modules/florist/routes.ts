import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { authenticate, requireRole } from '../../plugins/auth.js';
import { db } from '../../lib/db/index.js';
import { tenants } from '../../lib/db/schema/tenants.js';
import { getFloristSettings, updateFloristSettings } from './service.js';

const updateFloristSettingsSchema = z.object({
  autoRequirePhoto: z.boolean().optional(),
  defaultGiftDelivery: z.boolean().optional(),
  defaultGiftMessage: z.string().max(2000).optional(),
  defaultDeliveryInstructions: z.string().max(2000).optional(),
});

// Industry gate — reusable preHandler
async function requireFlorist(request: FastifyRequest, reply: FastifyReply) {
  const [row] = await db.select({ industry: tenants.industry })
    .from(tenants).where(eq(tenants.id, request.user.tenantId)).limit(1);
  if (row?.industry !== 'florist') {
    return reply.forbidden('This feature requires the florist industry');
  }
}

export async function floristRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);
  app.addHook('preHandler', requireFlorist);

  // ── Settings ────────────────────────────────────────────────────────

  app.get('/settings', { preHandler: [requireRole('admin')] }, async (request) => {
    return getFloristSettings(request.user.tenantId);
  });

  app.put('/settings', { preHandler: [requireRole('owner')] }, async (request) => {
    const body = updateFloristSettingsSchema.parse(request.body);
    return updateFloristSettings(request.user.tenantId, body, request.user.id);
  });
}
