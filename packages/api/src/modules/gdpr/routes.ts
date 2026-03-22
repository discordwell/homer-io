import type { FastifyInstance } from 'fastify';
import { dataDeletionRequestSchema, dataDeletionConfirmSchema, paginationSchema } from '@homer-io/shared';
import { authenticate, requireRole, denyDemo } from '../../plugins/auth.js';
import { requestDataExport, getExportStatus, listExportRequests, requestAccountDeletion, confirmDeletion, cancelDeletion, listDeletionRequests } from './service.js';

export async function gdprRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  app.post('/export', { preHandler: [requireRole('owner'), denyDemo] }, async (request, reply) => {
    const result = await requestDataExport(request.user.tenantId, request.user.id);
    reply.code(201).send(result);
  });

  app.get('/export/:id', async (request) => {
    const { id } = request.params as { id: string };
    return getExportStatus(request.user.tenantId, id);
  });

  app.get('/exports', async (request) => {
    const query = paginationSchema.parse(request.query);
    return listExportRequests(request.user.tenantId, query);
  });

  app.post('/delete-account', { preHandler: [requireRole('owner'), denyDemo] }, async (request, reply) => {
    const body = dataDeletionRequestSchema.parse(request.body);
    const result = await requestAccountDeletion(request.user.tenantId, request.user.id, body.confirmPhrase);
    reply.send(result);
  });

  app.post('/delete-account/confirm', { preHandler: [denyDemo] }, async (request) => {
    const body = dataDeletionConfirmSchema.parse(request.body);
    return confirmDeletion(request.user.tenantId, body.token);
  });

  app.delete('/delete-account', { preHandler: [requireRole('owner'), denyDemo] }, async (request) => {
    return cancelDeletion(request.user.tenantId);
  });

  app.get('/deletion-requests', async (request) => {
    const query = paginationSchema.parse(request.query);
    return listDeletionRequests(request.user.tenantId, query);
  });
}
