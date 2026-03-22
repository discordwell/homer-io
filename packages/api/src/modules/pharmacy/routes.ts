import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { updatePharmacySettingsSchema } from '@homer-io/shared';
import { authenticate, requireRole } from '../../plugins/auth.js';
import { getPharmacySettings, updatePharmacySettings, requirePharmacyIndustry } from './service.js';

async function requirePharmacy(request: FastifyRequest, reply: FastifyReply) {
  try {
    await requirePharmacyIndustry(request.user.tenantId);
  } catch {
    return reply.forbidden('This feature requires the pharmacy industry');
  }
}

export async function pharmacyRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);
  app.addHook('preHandler', requirePharmacy);

  app.get('/settings', { preHandler: [requireRole('admin')] }, async (request) => {
    return (await getPharmacySettings(request.user.tenantId)) ?? {};
  });

  app.put('/settings', { preHandler: [requireRole('owner')] }, async (request) => {
    const input = updatePharmacySettingsSchema.parse(request.body);
    return updatePharmacySettings(request.user.tenantId, input, request.user.id);
  });
}
