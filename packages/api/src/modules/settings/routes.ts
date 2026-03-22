import { FastifyInstance } from 'fastify';
import { updateOrgSettingsSchema } from '@homer-io/shared';
import { authenticate, requireRole, denyDemo } from '../../plugins/auth.js';
import { getOrgSettings, updateOrgSettings } from './service.js';

export async function settingsRoutes(app: FastifyInstance) {
  app.get('/organization', {
    preHandler: [authenticate, requireRole('admin')],
  }, async (request, reply) => {
    const settings = await getOrgSettings(request.user.tenantId);
    reply.send(settings);
  });

  app.put('/organization', {
    preHandler: [authenticate, requireRole('owner'), denyDemo],
  }, async (request, reply) => {
    const body = updateOrgSettingsSchema.parse(request.body);
    const settings = await updateOrgSettings(
      request.user.tenantId,
      body,
      request.user.id,
    );
    reply.send(settings);
  });
}
