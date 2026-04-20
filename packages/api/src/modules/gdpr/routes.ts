import type { FastifyInstance, FastifyRequest } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { dataDeletionRequestSchema, dataDeletionConfirmSchema, paginationSchema } from '@homer-io/shared';
import { authenticate, requireRole } from '../../plugins/auth.js';
import { requestDataExport, getExportStatus, listExportRequests, requestAccountDeletion, confirmDeletion, cancelDeletion, listDeletionRequests } from './service.js';

export async function gdprRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  // /export runs in its own scope so we can attach a tight, per-user rate
  // limiter (1 request/hour) without affecting other GDPR endpoints. An
  // unrestricted export endpoint is a DoS vector: each export is a full tenant
  // dump, so spamming it can fill BullMQ and storage and starve other tenants.
  await app.register(async (exportScope) => {
    await exportScope.register(rateLimit, {
      max: 1,
      timeWindow: '1 hour',
      // Run the limiter at preHandler (after authenticate has set request.user)
      // rather than the default onRequest hook — otherwise request.user is
      // undefined and every caller collapses to an IP-based bucket.
      hook: 'preHandler',
      // Authenticated endpoint — key per user so a compromised owner account
      // cannot spam; fall back to IP if user somehow unset.
      keyGenerator: (request: FastifyRequest) => request.user?.id ?? request.ip,
    });

    exportScope.post('/export', { preHandler: [requireRole('owner')] }, async (request, reply) => {
      const result = await requestDataExport(request.user.tenantId, request.user.id);
      reply.code(201).send(result);
    });
  });

  app.get('/export/:id', { preHandler: [requireRole('admin')] }, async (request) => {
    const { id } = request.params as { id: string };
    return getExportStatus(request.user.tenantId, id);
  });

  app.get('/exports', { preHandler: [requireRole('admin')] }, async (request) => {
    const query = paginationSchema.parse(request.query);
    return listExportRequests(request.user.tenantId, query);
  });

  app.post('/delete-account', { preHandler: [requireRole('owner')] }, async (request, reply) => {
    const body = dataDeletionRequestSchema.parse(request.body);
    const result = await requestAccountDeletion(request.user.tenantId, request.user.id, body.confirmPhrase);
    reply.send(result);
  });

  app.post('/delete-account/confirm', { preHandler: [requireRole('owner')] }, async (request) => {
    const body = dataDeletionConfirmSchema.parse(request.body);
    return confirmDeletion(request.user.tenantId, body.token);
  });

  app.delete('/delete-account', { preHandler: [requireRole('owner')] }, async (request) => {
    return cancelDeletion(request.user.tenantId);
  });

  app.get('/deletion-requests', { preHandler: [requireRole('admin')] }, async (request) => {
    const query = paginationSchema.parse(request.query);
    return listDeletionRequests(request.user.tenantId, query);
  });
}
