import { FastifyInstance } from 'fastify';
import { createNotificationTemplateSchema, updateNotificationTemplateSchema } from '@homer-io/shared';
import { authenticate, requireRole } from '../../plugins/auth.js';
import {
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  sendTestNotification,
  listNotificationLog,
} from './service.js';

export async function customerNotificationTemplateRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  // GET /settings/notification-templates — list all templates
  app.get('/', { preHandler: [requireRole('admin')] }, async (request) => {
    return listTemplates(request.user.tenantId);
  });

  // POST /settings/notification-templates — create template
  app.post('/', { preHandler: [requireRole('admin')] }, async (request, reply) => {
    const body = createNotificationTemplateSchema.parse(request.body);
    const template = await createTemplate(request.user.tenantId, body);
    reply.code(201).send(template);
  });

  // PUT /settings/notification-templates/:id — update template
  app.put('/:id', { preHandler: [requireRole('admin')] }, async (request) => {
    const { id } = request.params as { id: string };
    const body = updateNotificationTemplateSchema.parse(request.body);
    return updateTemplate(request.user.tenantId, id, body);
  });

  // DELETE /settings/notification-templates/:id — delete template
  app.delete('/:id', { preHandler: [requireRole('admin')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await deleteTemplate(request.user.tenantId, id);
    reply.code(204).send();
  });

  // POST /settings/notification-templates/:id/test — send test notification
  app.post('/:id/test', { preHandler: [requireRole('admin')] }, async (request) => {
    const { id } = request.params as { id: string };
    return sendTestNotification(request.user.tenantId, id);
  });
}

export async function customerNotificationLogRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  // GET /notifications/customer-log — list notification log with pagination
  app.get('/', { preHandler: [requireRole('dispatcher')] }, async (request) => {
    const { page, limit } = request.query as { page?: string; limit?: string };
    return listNotificationLog(request.user.tenantId, {
      page: Math.max(1, Number(page) || 1),
      limit: Math.min(100, Math.max(1, Number(limit) || 25)),
    });
  });
}
