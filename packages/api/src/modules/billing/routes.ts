import { z } from 'zod';
import { FastifyInstance } from 'fastify';
import { checkoutRequestSchema, changePlanRequestSchema, payAsYouGoRequestSchema, planFeatures } from '@homer-io/shared';
import { authenticate, requireRole, denyDemo } from '../../plugins/auth.js';
import {
  getSubscription,
  createCheckoutSession,
  createPortalSession,
  getInvoices,
  changePlan,
  togglePayAsYouGo,
  getMeteredUsage,
} from './service.js';

const portalRequestSchema = z.object({
  returnUrl: z.string().url().optional(),
});

const invoicesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export async function billingRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);
  app.addHook('preHandler', requireRole('owner'));
  app.addHook('preHandler', denyDemo);

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
    const body = portalRequestSchema.parse(request.body || {});
    return createPortalSession(request.user.tenantId, body.returnUrl || '');
  });

  // GET /api/billing/invoices — paginated invoice history
  app.get('/invoices', async (request) => {
    const { page, limit } = invoicesQuerySchema.parse(request.query);
    return getInvoices(request.user.tenantId, page, limit);
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

  // POST /api/billing/pay-as-you-go — toggle metered billing
  app.post('/pay-as-you-go', async (request) => {
    const body = payAsYouGoRequestSchema.parse(request.body);
    return togglePayAsYouGo(request.user.tenantId, body.enabled);
  });

  // GET /api/billing/metered-usage — current metered usage + overage costs
  app.get('/metered-usage', async (request) => {
    return getMeteredUsage(request.user.tenantId);
  });
}
