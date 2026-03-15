import { FastifyInstance } from 'fastify';
import { sendMessageSchema, messageListQuerySchema } from '@homer-io/shared';
import { authenticate } from '../../plugins/auth.js';
import { sendMessage, listMessages, markAsRead, getUnreadCount } from './service.js';

export async function messageRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  app.post('/', async (request, reply) => {
    const body = sendMessageSchema.parse(request.body);
    const result = await sendMessage(request.user.tenantId, request.user.id, body);
    reply.code(201).send(result);
  });

  app.get('/', async (request) => {
    const query = messageListQuerySchema.parse(request.query);
    return listMessages(request.user.tenantId, query);
  });

  app.patch('/:id/read', async (request) => {
    const { id } = request.params as { id: string };
    return markAsRead(request.user.tenantId, id, request.user.id);
  });

  app.get('/unread-count', async (request) => {
    return getUnreadCount(request.user.tenantId, request.user.id);
  });
}
