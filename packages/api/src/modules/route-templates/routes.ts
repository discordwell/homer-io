import { FastifyInstance } from 'fastify';
import { createRouteTemplateSchema, paginationSchema } from '@homer-io/shared';
import { authenticate, requireRole } from '../../plugins/auth.js';
import { createTemplate, listTemplates, getTemplate, updateTemplate, deleteTemplate, generateRouteFromTemplate } from './service.js';

export async function routeTemplateRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  app.get('/', async (request) => {
    const query = paginationSchema.parse(request.query);
    return listTemplates(request.user.tenantId, query);
  });

  app.post('/', { preHandler: [requireRole('admin')] }, async (request, reply) => {
    const body = createRouteTemplateSchema.parse(request.body);
    const template = await createTemplate(request.user.tenantId, body);
    reply.code(201).send(template);
  });

  app.get('/:id', async (request) => {
    const { id } = request.params as { id: string };
    return getTemplate(request.user.tenantId, id);
  });

  app.patch('/:id', { preHandler: [requireRole('admin')] }, async (request) => {
    const { id } = request.params as { id: string };
    const body = createRouteTemplateSchema.partial().parse(request.body);
    return updateTemplate(request.user.tenantId, id, body);
  });

  app.delete('/:id', { preHandler: [requireRole('admin')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await deleteTemplate(request.user.tenantId, id);
    reply.code(204).send();
  });

  app.post('/:id/generate', { preHandler: [requireRole('admin')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const route = await generateRouteFromTemplate(request.user.tenantId, id);
    reply.code(201).send(route);
  });
}
