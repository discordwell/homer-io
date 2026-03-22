import { z } from 'zod';
import { FastifyInstance } from 'fastify';
import { setIndustrySchema } from '@homer-io/shared';
import { authenticate, requireRole } from '../../plugins/auth.js';
import { getOnboardingStatus, completeOnboarding, skipOnboarding, skipStep, setIndustry, loadSampleData, areNotificationProvidersConfigured } from './service.js';

const skipStepSchema = z.object({ stepKey: z.string().min(1) });

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

  // Skip an individual onboarding step (e.g. notifications when providers aren't configured)
  app.post('/skip-step', { preHandler: [requireRole('admin')] }, async (request) => {
    const { stepKey } = skipStepSchema.parse(request.body);
    return skipStep(request.user.tenantId, stepKey);
  });

  // Set the tenant's industry during onboarding
  app.post('/set-industry', { preHandler: [requireRole('admin')] }, async (request) => {
    const { industry } = setIndustrySchema.parse(request.body);
    return setIndustry(request.user.tenantId, industry);
  });

  // Load industry-flavored sample orders
  app.post('/load-sample-data', { preHandler: [requireRole('admin')] }, async (request) => {
    return loadSampleData(request.user.tenantId);
  });

  // Check whether notification providers are configured server-side
  app.get('/provider-status', async () => {
    const providers = areNotificationProvidersConfigured();
    return {
      sms: { configured: providers.sms, provider: 'Twilio' },
      email: { configured: providers.email, provider: 'SendGrid' },
    };
  });
}
