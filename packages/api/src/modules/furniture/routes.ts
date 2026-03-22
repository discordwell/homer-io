import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { authenticate, requireRole } from '../../plugins/auth.js';
import { db } from '../../lib/db/index.js';
import { tenants } from '../../lib/db/schema/tenants.js';
import { getFurnitureSettings, updateFurnitureSettings } from './service.js';

const updateFurnitureSettingsSchema = z.object({
  defaultCrewSize: z.number().int().min(1).max(4).optional(),
  assemblyService: z.boolean().optional(),
  haulAwayService: z.boolean().optional(),
  defaultTimeWindowHours: z.number().int().min(1).max(8).optional(),
  whiteGloveChecklist: z.boolean().optional(),
});

// Industry gate -- reusable preHandler
async function requireFurniture(request: FastifyRequest, reply: FastifyReply) {
  const [row] = await db.select({ industry: tenants.industry })
    .from(tenants).where(eq(tenants.id, request.user.tenantId)).limit(1);
  if (row?.industry !== 'furniture') {
    return reply.forbidden('This feature requires the furniture industry');
  }
}

export async function furnitureRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);
  app.addHook('preHandler', requireFurniture);

  // -- Settings --

  app.get('/settings', { preHandler: [requireRole('admin')] }, async (request) => {
    return getFurnitureSettings(request.user.tenantId);
  });

  app.put('/settings', { preHandler: [requireRole('owner')] }, async (request) => {
    const body = updateFurnitureSettingsSchema.parse(request.body);
    return updateFurnitureSettings(request.user.tenantId, body, request.user.id);
  });
}
