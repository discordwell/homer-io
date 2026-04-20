import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import sensible from '@fastify/sensible';
import rateLimit from '@fastify/rate-limit';
import { ZodError } from 'zod';
import { config } from './config.js';
import { HttpError } from './lib/errors.js';
import { authRoutes } from './modules/auth/routes.js';
import { fleetRoutes } from './modules/fleet/routes.js';
import { orderRoutes } from './modules/orders/routes.js';
import { routeRoutes } from './modules/routes/routes.js';
import { dashboardRoutes } from './modules/dashboard/routes.js';
import { aiRoutes } from './modules/ai/routes.js';
import { trackingRoutes } from './modules/tracking/routes.js';
import { analyticsRoutes } from './modules/analytics/routes.js';
import { settingsRoutes } from './modules/settings/routes.js';
import { teamRoutes } from './modules/team/routes.js';
import { apiKeyRoutes } from './modules/api-keys/routes.js';
import { notificationRoutes } from './modules/notifications/routes.js';
import { customerNotificationTemplateRoutes, customerNotificationLogRoutes } from './modules/customer-notifications/routes.js';
import { driverRoutes, driverInvitePublicRoutes } from './modules/driver/routes.js';
import { deviceRoutes } from './modules/devices/routes.js';
import { podRoutes } from './modules/pod/routes.js';
import { dispatchRoutes } from './modules/dispatch/routes.js';
import { initSocketIO } from './lib/ws/index.js';
import { registerSwagger } from './plugins/swagger.js';
import { publicRoutes } from './modules/public/routes.js';
import { webhookRoutes } from './modules/webhooks/routes.js';
import { billingRoutes } from './modules/billing/routes.js';
import { billingWebhookPlugin } from './modules/billing/webhook.js';
import { integrationRoutes, integrationWebhookRoutes } from './modules/integrations/routes.js';
import { etaRoutes } from './modules/eta/routes.js';
import { carbonRoutes } from './modules/carbon/routes.js';
import { reportRoutes } from './modules/reports/routes.js';
import { onboardingRoutes } from './modules/onboarding/routes.js';
import { routeTemplateRoutes } from './modules/route-templates/routes.js';
import { messageRoutes } from './modules/messages/routes.js';
import { requireActiveSubscription } from './plugins/billing.js';
import { gdprRoutes } from './modules/gdpr/routes.js';
import { adminHealthRoutes } from './modules/health/routes.js';
import { intelligenceRoutes } from './modules/intelligence/routes.js';
import { migrationRoutes } from './modules/migration/routes.js';
import { cannabisRoutes } from './modules/cannabis/routes.js';
import { floristRoutes } from './modules/florist/routes.js';
import { pharmacyRoutes } from './modules/pharmacy/routes.js';
import { restaurantRoutes } from './modules/restaurant/routes.js';
import { groceryRoutes } from './modules/grocery/routes.js';
import { furnitureRoutes } from './modules/furniture/routes.js';

const app = Fastify({
  // Restrict proxy trust to prevent X-Forwarded-* spoofing
  // (GHSA-444r-cwp2-x5xf). Defaults to loopback-only (Caddy → API on same
  // host); configurable via TRUST_PROXY env var. See packages/api/src/config.ts.
  trustProxy: config.server.trustProxy,
  logger: {
    level: config.nodeEnv === 'production' ? 'info' : 'debug',
    transport: config.nodeEnv !== 'production' ? {
      target: 'pino-pretty',
      options: { colorize: true },
    } : undefined,
  },
});

// Global error handler — catch Zod and HttpError, clean up responses
app.setErrorHandler((error, request, reply) => {
  if (error instanceof ZodError) {
    return reply.status(400).send({
      statusCode: 400,
      error: 'Validation Error',
      message: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; '),
    });
  }
  if (error instanceof HttpError) {
    return reply.status(error.statusCode).send({
      statusCode: error.statusCode,
      error: error.constructor.name,
      message: error.message,
    });
  }
  // @fastify/sensible and Fastify-native 4xx errors — pass through with sanitized shape
  const err = error as { statusCode?: unknown; name?: string; message?: string };
  if (typeof err.statusCode === 'number' && err.statusCode < 500) {
    return reply.status(err.statusCode).send({
      statusCode: err.statusCode,
      error: err.name === 'FastifyError' ? 'Bad Request' : (err.name || 'Error'),
      message: err.message,
    });
  }
  // Everything else (DB errors, unexpected throws) — log and return generic 500
  app.log.error(error);
  return reply.status(500).send({
    statusCode: 500,
    error: 'Internal Server Error',
    message: 'An internal error occurred. Please try again later.',
  });
});

// Plugins
await app.register(cors, { origin: config.cors.origin, credentials: true });
await app.register(jwt, { secret: config.jwt.secret });
await app.register(sensible);
await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });

// Security headers
app.addHook('onSend', async (_request, reply) => {
  reply.header('X-Frame-Options', 'DENY');
  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('X-XSS-Protection', '0');
  reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  reply.header('Permissions-Policy', 'camera=(), microphone=(self), geolocation=()');
  if (config.nodeEnv === 'production') {
    reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
});

// Swagger / OpenAPI docs
await registerSwagger(app);

// Health check
app.get('/health', async () => ({
  status: 'ok',
  timestamp: new Date().toISOString(),
}));

// Stripe webhook — must be registered at root level (outside /api) with raw body parsing
await app.register(billingWebhookPlugin);

// API routes
await app.register(async (api) => {
  // Billing enforcement — skip for auth, public, health, stripe routes
  api.addHook('preHandler', requireActiveSubscription);
  // Tighter rate limit on auth endpoints to prevent brute force
  await api.register(async (authScope) => {
    await authScope.register(rateLimit, { max: 10, timeWindow: '1 minute' });
    await authScope.register(authRoutes);
  }, { prefix: '/auth' });
  await api.register(fleetRoutes, { prefix: '/fleet' });
  await api.register(orderRoutes, { prefix: '/orders' });
  await api.register(routeRoutes, { prefix: '/routes' });
  await api.register(dashboardRoutes, { prefix: '/dashboard' });
  // AI endpoints — tighter rate limit (20/min to accommodate voice: transcribe + ops + tts per interaction)
  await api.register(async (aiScope) => {
    await aiScope.register(rateLimit, { max: 20, timeWindow: '1 minute' });
    await aiScope.register(aiRoutes);
  }, { prefix: '/ai' });
  // Tracking endpoints — 60/min for driver location POST
  await api.register(async (trackingScope) => {
    await trackingScope.register(rateLimit, { max: 60, timeWindow: '1 minute' });
    await trackingScope.register(trackingRoutes);
  }, { prefix: '/tracking' });

  // Public routes — no auth required, rate limited within the plugin
  await api.register(publicRoutes, { prefix: '/public' });
  await api.register(driverInvitePublicRoutes, { prefix: '/driver/invite' });
  await api.register(analyticsRoutes, { prefix: '/analytics' });
  await api.register(settingsRoutes, { prefix: '/settings' });
  await api.register(teamRoutes, { prefix: '/team' });
  await api.register(apiKeyRoutes, { prefix: '/api-keys' });
  await api.register(notificationRoutes, { prefix: '/notifications' });
  await api.register(customerNotificationTemplateRoutes, { prefix: '/settings/notification-templates' });
  await api.register(customerNotificationLogRoutes, { prefix: '/notifications/customer-log' });
  await api.register(driverRoutes, { prefix: '/driver' });
  await api.register(deviceRoutes, { prefix: '/devices' });
  await api.register(podRoutes, { prefix: '/pod' });
  // AI-powered auto-dispatch — tighter rate limit (5/min)
  await api.register(async (dispatchScope) => {
    await dispatchScope.register(rateLimit, { max: 5, timeWindow: '1 minute' });
    await dispatchScope.register(dispatchRoutes);
  }, { prefix: '/dispatch' });
  await api.register(webhookRoutes, { prefix: '/webhooks' });
  await api.register(billingRoutes, { prefix: '/billing' });
  await api.register(integrationRoutes, { prefix: '/integrations' });
  await api.register(integrationWebhookRoutes, { prefix: '/integrations/webhook' });
  await api.register(etaRoutes);
  await api.register(carbonRoutes, { prefix: '/analytics' });
  await api.register(reportRoutes, { prefix: '/reports' });
  await api.register(onboardingRoutes, { prefix: '/onboarding' });
  await api.register(routeTemplateRoutes, { prefix: '/route-templates' });
  await api.register(messageRoutes, { prefix: '/messages' });
  await api.register(gdprRoutes, { prefix: '/gdpr' });
  await api.register(adminHealthRoutes, { prefix: '/admin/health' });
  await api.register(intelligenceRoutes, { prefix: '/intelligence' });
  await api.register(migrationRoutes, { prefix: '/migrations' });
  await api.register(cannabisRoutes, { prefix: '/cannabis' });
  await api.register(floristRoutes, { prefix: '/florist' });
  await api.register(pharmacyRoutes, { prefix: '/pharmacy' });
  await api.register(restaurantRoutes, { prefix: '/restaurant' });
  await api.register(groceryRoutes, { prefix: '/grocery' });
  await api.register(furnitureRoutes, { prefix: '/furniture' });
}, { prefix: '/api' });

// Graceful shutdown
const signals = ['SIGINT', 'SIGTERM'];
for (const signal of signals) {
  process.on(signal, async () => {
    app.log.info(`Received ${signal}, shutting down...`);
    await app.close();
    process.exit(0);
  });
}

// Start
try {
  await app.listen({ port: config.port, host: config.host });
  initSocketIO(app.server);
  app.log.info(`HOMER.io API running at http://${config.host}:${config.port}`);
  app.log.info('Socket.IO attached to HTTP server on /fleet namespace');
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

export { app };
