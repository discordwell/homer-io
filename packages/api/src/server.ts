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
import { driverRoutes } from './modules/driver/routes.js';
import { podRoutes } from './modules/pod/routes.js';
import { dispatchRoutes } from './modules/dispatch/routes.js';
import { initSocketIO } from './lib/ws/index.js';
import { registerSwagger } from './plugins/swagger.js';
import { publicRoutes } from './modules/public/routes.js';
import { webhookRoutes } from './modules/webhooks/routes.js';

const app = Fastify({
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
  // Sanitize database/internal errors — never leak SQL queries or stack traces
  const msg = (error as Error).message || '';
  if (msg.startsWith('Failed query:') || msg.includes('violates')) {
    app.log.error(error);
    return reply.status(500).send({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'An internal error occurred. Please try again later.',
    });
  }
  // Let Fastify handle everything else (including @fastify/sensible errors)
  reply.send(error);
});

// Plugins
await app.register(cors, { origin: config.cors.origin, credentials: true });
await app.register(jwt, { secret: config.jwt.secret });
await app.register(sensible);
await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });

// Swagger / OpenAPI docs
await registerSwagger(app);

// Health check
app.get('/health', async () => ({
  status: 'ok',
  timestamp: new Date().toISOString(),
  version: '0.1.0',
}));

// API routes
await app.register(async (api) => {
  // Tighter rate limit on auth endpoints to prevent brute force
  await api.register(async (authScope) => {
    await authScope.register(rateLimit, { max: 10, timeWindow: '1 minute' });
    await authScope.register(authRoutes);
  }, { prefix: '/auth' });
  await api.register(fleetRoutes, { prefix: '/fleet' });
  await api.register(orderRoutes, { prefix: '/orders' });
  await api.register(routeRoutes, { prefix: '/routes' });
  await api.register(dashboardRoutes, { prefix: '/dashboard' });
  // AI endpoints — tighter rate limit (5/min)
  await api.register(async (aiScope) => {
    await aiScope.register(rateLimit, { max: 5, timeWindow: '1 minute' });
    await aiScope.register(aiRoutes);
  }, { prefix: '/ai' });
  // Tracking endpoints — 60/min for driver location POST
  await api.register(async (trackingScope) => {
    await trackingScope.register(rateLimit, { max: 60, timeWindow: '1 minute' });
    await trackingScope.register(trackingRoutes);
  }, { prefix: '/tracking' });

  // Public routes — no auth required, rate limited within the plugin
  await api.register(publicRoutes, { prefix: '/public' });
  await api.register(analyticsRoutes, { prefix: '/analytics' });
  await api.register(settingsRoutes, { prefix: '/settings' });
  await api.register(teamRoutes, { prefix: '/team' });
  await api.register(apiKeyRoutes, { prefix: '/api-keys' });
  await api.register(notificationRoutes, { prefix: '/notifications' });
  await api.register(customerNotificationTemplateRoutes, { prefix: '/settings/notification-templates' });
  await api.register(customerNotificationLogRoutes, { prefix: '/notifications/customer-log' });
  await api.register(driverRoutes, { prefix: '/driver' });
  await api.register(podRoutes, { prefix: '/pod' });
  // AI-powered auto-dispatch — tighter rate limit (5/min)
  await api.register(async (dispatchScope) => {
    await dispatchScope.register(rateLimit, { max: 5, timeWindow: '1 minute' });
    await dispatchScope.register(dispatchRoutes);
  }, { prefix: '/dispatch' });
  await api.register(webhookRoutes, { prefix: '/webhooks' });
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
