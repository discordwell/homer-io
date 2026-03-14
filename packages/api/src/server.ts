import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import sensible from '@fastify/sensible';
import rateLimit from '@fastify/rate-limit';
import { config } from './config.js';
import { authRoutes } from './modules/auth/routes.js';
import { fleetRoutes } from './modules/fleet/routes.js';
import { orderRoutes } from './modules/orders/routes.js';
import { routeRoutes } from './modules/routes/routes.js';

const app = Fastify({
  logger: {
    level: config.nodeEnv === 'production' ? 'info' : 'debug',
    transport: config.nodeEnv !== 'production' ? {
      target: 'pino-pretty',
      options: { colorize: true },
    } : undefined,
  },
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
  await api.register(authRoutes, { prefix: '/auth' });
  await api.register(fleetRoutes, { prefix: '/fleet' });
  await api.register(orderRoutes, { prefix: '/orders' });
  await api.register(routeRoutes, { prefix: '/routes' });
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
