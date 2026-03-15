import { FastifyInstance } from 'fastify';
import { checkoutRequestSchema, changePlanRequestSchema, planFeatures } from '@homer-io/shared';
import { authenticate, requireRole } from '../../plugins/auth.js';
import {
  getSubscription,
  createCheckoutSession,
  createPortalSession,
  getInvoices,
  changePlan,
} from './service.js';

export async function billingRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);
  app.addHook('preHandler', requireRole('owner'));

  // GET /api/billing/subscription — current plan + usage
  app.get('/subscription', async (request) => {
    return getSubscription(request.user.tenantId);
  });

  // POST /api/billing/checkout — create Stripe Checkout Session URL
  app.post('/checkout', async (request) => {
    const body = checkoutRequestSchema.parse(request.body);
    return createCheckoutSession(request.user.tenantId, body.plan, body.interval, {
      successUrl: body.successUrl,
      cancelUrl: body.cancelUrl,
    });
  });

  // POST /api/billing/portal — create Stripe Customer Portal URL
  app.post('/portal', async (request) => {
    const { returnUrl } = (request.body as { returnUrl?: string }) || {};
    return createPortalSession(request.user.tenantId, returnUrl || '');
  });

  // GET /api/billing/invoices — paginated invoice history
  app.get('/invoices', async (request) => {
    const { page = '1', limit = '10' } = request.query as { page?: string; limit?: string };
    return getInvoices(request.user.tenantId, Number(page), Number(limit));
  });

  // GET /api/billing/plans — available plans with features
  app.get('/plans', async () => {
    return planFeatures;
  });

  // POST /api/billing/change-plan — upgrade/downgrade
  app.post('/change-plan', async (request) => {
    const body = changePlanRequestSchema.parse(request.body);
    return changePlan(request.user.tenantId, body.plan, body.interval);
  });
}
