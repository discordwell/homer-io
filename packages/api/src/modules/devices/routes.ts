import { FastifyInstance } from 'fastify';
import { registerDeviceSchema } from '@homer-io/shared';
import { authenticate } from '../../plugins/auth.js';
import { registerDevice, unregisterDevice } from './service.js';

export async function deviceRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  // POST /api/devices/register — register push notification token
  app.post('/register', async (request) => {
    const { tenantId, id: userId } = request.user;
    const { token, platform } = registerDeviceSchema.parse(request.body);
    await registerDevice(userId, tenantId, token, platform);
    return { success: true };
  });

  // DELETE /api/devices/unregister — remove all tokens for current user (logout)
  app.delete('/unregister', async (request) => {
    const { id: userId } = request.user;
    await unregisterDevice(userId);
    return { success: true };
  });
}
