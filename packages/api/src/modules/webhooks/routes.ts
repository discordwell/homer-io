import { FastifyInstance } from 'fastify';
import { createWebhookEndpointSchema, updateWebhookEndpointSchema } from '@homer-io/shared';
import { authenticate, requireRole, denyDemo } from '../../plugins/auth.js';
import {
  createEndpoint,
  listEndpoints,
  updateEndpoint,
  deleteEndpoint,
  testEndpoint,
  listDeliveries,
} from './service.js';

export async function webhookRoutes(app: FastifyInstance) {
  // POST / — Create a new webhook endpoint
  app.post('/', {
    preHandler: [authenticate, requireRole('admin'), denyDemo],
  }, async (request, reply) => {
    const body = createWebhookEndpointSchema.parse(request.body);
    const result = await createEndpoint(
      request.user.tenantId,
      request.user.id,
      body,
    );
    reply.code(201).send(result);
  });

  // GET / — List all webhook endpoints for tenant
  app.get('/', {
    preHandler: [authenticate, requireRole('admin')],
  }, async (request, reply) => {
    const endpoints = await listEndpoints(request.user.tenantId);
    reply.send(endpoints);
  });

  // PUT /:id — Update a webhook endpoint
  app.put('/:id', {
    preHandler: [authenticate, requireRole('admin'), denyDemo],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateWebhookEndpointSchema.parse(request.body);
    const result = await updateEndpoint(
      request.user.tenantId,
      id,
      request.user.id,
      body,
    );
    reply.send(result);
  });

  // DELETE /:id — Delete a webhook endpoint
  app.delete('/:id', {
    preHandler: [authenticate, requireRole('admin'), denyDemo],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await deleteEndpoint(
      request.user.tenantId,
      id,
      request.user.id,
    );
    reply.code(204).send();
  });

  // POST /:id/test — Send a test webhook
  app.post('/:id/test', {
    preHandler: [authenticate, requireRole('admin'), denyDemo],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await testEndpoint(
      request.user.tenantId,
      id,
      request.user.id,
    );
    reply.send(result);
  });

  // GET /:id/deliveries — List delivery history for an endpoint
  app.get('/:id/deliveries', {
    preHandler: [authenticate, requireRole('admin')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = request.query as { page?: string; limit?: string };
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const result = await listDeliveries(
      request.user.tenantId,
      id,
      page,
      limit,
    );
    reply.send(result);
  });
}
