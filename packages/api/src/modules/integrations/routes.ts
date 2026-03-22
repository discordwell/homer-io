import { FastifyInstance } from 'fastify';
import { createConnectionSchema, updateConnectionSchema } from '@homer-io/shared';
import { authenticate, requireRole, denyDemo } from '../../plugins/auth.js';
import {
  listConnections,
  getConnection,
  createConnection,
  updateConnection,
  deleteConnection,
  testConnection,
  syncOrders,
  listIntegrationOrders,
  getAvailablePlatforms,
  processInboundWebhook,
} from './service.js';

export async function integrationRoutes(app: FastifyInstance) {
  // GET /platforms — Available platforms with credential field info
  app.get('/platforms', {
    preHandler: [authenticate, requireRole('admin')],
  }, async (_request, reply) => {
    const platforms = getAvailablePlatforms();
    reply.send(platforms);
  });

  // GET /connections — List all connections for tenant
  app.get('/connections', {
    preHandler: [authenticate, requireRole('admin')],
  }, async (request, reply) => {
    const connections = await listConnections(request.user.tenantId);
    reply.send(connections);
  });

  // POST /connections — Create a new connection
  app.post('/connections', {
    preHandler: [authenticate, requireRole('admin'), denyDemo],
  }, async (request, reply) => {
    const body = createConnectionSchema.parse(request.body);
    const result = await createConnection(
      request.user.tenantId,
      request.user.id,
      body,
    );
    reply.code(201).send(result);
  });

  // GET /connections/:id — Get a single connection
  app.get('/connections/:id', {
    preHandler: [authenticate, requireRole('admin')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const connection = await getConnection(request.user.tenantId, id);
    reply.send(connection);
  });

  // PUT /connections/:id — Update a connection
  app.put('/connections/:id', {
    preHandler: [authenticate, requireRole('admin'), denyDemo],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateConnectionSchema.parse(request.body);
    const result = await updateConnection(
      request.user.tenantId,
      id,
      request.user.id,
      body,
    );
    reply.send(result);
  });

  // DELETE /connections/:id — Delete a connection
  app.delete('/connections/:id', {
    preHandler: [authenticate, requireRole('admin'), denyDemo],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await deleteConnection(
      request.user.tenantId,
      id,
      request.user.id,
    );
    reply.code(204).send();
  });

  // POST /connections/:id/test — Test credentials
  app.post('/connections/:id/test', {
    preHandler: [authenticate, requireRole('admin'), denyDemo],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await testConnection(request.user.tenantId, id);
    reply.send(result);
  });

  // POST /connections/:id/sync — Trigger manual sync
  app.post('/connections/:id/sync', {
    preHandler: [authenticate, requireRole('admin'), denyDemo],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await syncOrders(request.user.tenantId, id);
    reply.send(result);
  });

  // GET /connections/:id/orders — List imported orders for a connection
  app.get('/connections/:id/orders', {
    preHandler: [authenticate, requireRole('admin')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = request.query as { page?: string; limit?: string };
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const result = await listIntegrationOrders(
      request.user.tenantId,
      id,
      page,
      limit,
    );
    reply.send(result);
  });
}

/**
 * Inbound webhook receiver — no JWT auth, uses platform-specific signature verification.
 * Mounted separately at /api/integrations/webhook/:platform/:connectionId
 */
export async function integrationWebhookRoutes(app: FastifyInstance) {
  app.post('/:platform/:connectionId', {
    config: {
      rawBody: true,
    },
  }, async (request, reply) => {
    const { platform, connectionId } = request.params as { platform: string; connectionId: string };
    const body = request.body as Record<string, unknown>;

    // Extract platform-specific signature header
    let signature: string | null = null;
    const headers = request.headers;
    if (platform === 'shopify') {
      signature = (headers['x-shopify-hmac-sha256'] as string) || null;
    } else if (platform === 'woocommerce') {
      signature = (headers['x-wc-webhook-signature'] as string) || null;
    }

    const querySecret = (request.query as { secret?: string })?.secret || null;
    const result = await processInboundWebhook(connectionId, platform, body, signature, querySecret);
    reply.send(result);
  });
}
