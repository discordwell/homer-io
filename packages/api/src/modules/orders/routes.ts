import { FastifyInstance } from 'fastify';
import { createOrderSchema, updateOrderStatusSchema, paginationSchema, csvImportSchema, batchOrderStatusSchema, batchDriverAssignSchema } from '@homer-io/shared';
import { authenticate, requireRole } from '../../plugins/auth.js';
import { createOrder, listOrders, getOrder, updateOrderStatus, deleteOrder, importOrdersCsv, batchUpdateStatus, batchAssignToRoute } from './service.js';
import { OrderLimitExceededError } from '../billing/service.js';

export async function orderRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  app.post('/', { preHandler: [requireRole('dispatcher')] }, async (request, reply) => {
    const body = createOrderSchema.parse(request.body);
    try {
      const order = await createOrder(request.user.tenantId, body);
      reply.code(201).send(order);
    } catch (err) {
      if (err instanceof OrderLimitExceededError) {
        return reply.code(402).send({
          message: err.message,
          status: 'order_limit_reached',
          ordersUsed: err.ordersUsed,
          ordersLimit: err.ordersLimit,
          readOnly: false,
        });
      }
      throw err;
    }
  });

  app.get('/', async (request) => {
    const query = paginationSchema.parse(request.query);
    const { status, search, dateFrom, dateTo, sortBy, sortDir } = request.query as {
      status?: string;
      search?: string;
      dateFrom?: string;
      dateTo?: string;
      sortBy?: string;
      sortDir?: 'asc' | 'desc';
    };
    return listOrders(request.user.tenantId, query, status, search, dateFrom, dateTo, sortBy, sortDir);
  });

  app.get('/:id', async (request) => {
    const { id } = request.params as { id: string };
    return getOrder(request.user.tenantId, id);
  });

  app.patch('/:id/status', { preHandler: [requireRole('driver')] }, async (request) => {
    const { id } = request.params as { id: string };
    const body = updateOrderStatusSchema.parse(request.body);
    return updateOrderStatus(request.user.tenantId, id, body);
  });

  app.delete('/:id', { preHandler: [requireRole('admin')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await deleteOrder(request.user.tenantId, id);
    reply.code(204).send();
  });

  app.post('/import/csv', { preHandler: [requireRole('dispatcher')] }, async (request, reply) => {
    const { orders: orderRows } = csvImportSchema.parse(request.body);
    try {
      const result = await importOrdersCsv(request.user.tenantId, orderRows);
      reply.code(201).send(result);
    } catch (err) {
      if (err instanceof OrderLimitExceededError) {
        return reply.code(402).send({
          message: err.message,
          status: 'order_limit_reached',
          ordersUsed: err.ordersUsed,
          ordersLimit: err.ordersLimit,
          readOnly: false,
        });
      }
      throw err;
    }
  });

  app.post('/batch/status', { preHandler: [requireRole('dispatcher')] }, async (request, reply) => {
    const body = batchOrderStatusSchema.parse(request.body);
    const result = await batchUpdateStatus(request.user.tenantId, body.orderIds, body.status);
    reply.send(result);
  });

  app.post('/batch/assign', { preHandler: [requireRole('dispatcher')] }, async (request, reply) => {
    const body = batchDriverAssignSchema.parse(request.body);
    const result = await batchAssignToRoute(request.user.tenantId, body.orderIds, body.routeId);
    reply.send(result);
  });
}
