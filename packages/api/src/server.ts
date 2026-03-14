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
  // Let Fastify handle everything else (including @fastify/sensible errors)
  reply.send(error);
});

// Plugins
await app.register(cors, { origin: config.cors.origin, credentials: true });
await app.register(jwt, { secret: config.jwt.secret });
await app.register(sensible);
await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });

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
  await api.register(aiRoutes, { prefix: '/ai' });
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
  app.log.info(`HOMER.io API running at http://${config.host}:${config.port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

export { app };
