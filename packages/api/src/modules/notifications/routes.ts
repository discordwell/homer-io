import { FastifyInstance } from 'fastify';
import { authenticate } from '../../plugins/auth.js';
import {
  listNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from './service.js';

export async function notificationRoutes(app: FastifyInstance) {
  app.get('/', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const query = request.query as {
      page?: string;
      limit?: string;
      read?: string;
    };

    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)));

    let readFilter: boolean | undefined;
    if (query.read === 'true') readFilter = true;
    else if (query.read === 'false') readFilter = false;

    const result = await listNotifications(
      request.user.tenantId,
      request.user.id,
      { page, limit },
      readFilter,
    );

    reply.send(result);
  });

  app.get('/unread-count', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const count = await getUnreadCount(
      request.user.tenantId,
      request.user.id,
    );
    reply.send({ count });
  });

  app.patch('/:id/read', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await markAsRead(
      request.user.tenantId,
      request.user.id,
      id,
    );

    if (!result) {
      return reply.notFound('Notification not found');
    }

    reply.send(result);
  });

  app.post('/mark-all-read', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const result = await markAllAsRead(
      request.user.tenantId,
      request.user.id,
    );
    reply.send(result);
  });
}
