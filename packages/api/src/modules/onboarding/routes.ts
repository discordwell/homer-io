import { FastifyInstance } from 'fastify';
import { authenticate, requireRole } from '../../plugins/auth.js';
import { getOnboardingStatus, completeOnboarding, skipOnboarding } from './service.js';

export async function onboardingRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  app.get('/status', async (request) => {
    return getOnboardingStatus(request.user.tenantId);
  });

  app.post('/complete', { preHandler: [requireRole('admin')] }, async (request) => {
    await completeOnboarding(request.user.tenantId);
    return { success: true };
  });

  app.post('/skip', { preHandler: [requireRole('admin')] }, async (request) => {
    await skipOnboarding(request.user.tenantId);
    return { success: true };
  });
}
