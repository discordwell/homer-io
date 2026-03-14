import { FastifyInstance } from 'fastify';
import { createOrderSchema, updateOrderStatusSchema, paginationSchema } from '@homer-io/shared';
import { authenticate, requireRole } from '../../plugins/auth.js';
import { createOrder, listOrders, getOrder, updateOrderStatus, deleteOrder, importOrdersCsv } from './service.js';

export async function orderRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  app.post('/', { preHandler: [requireRole('dispatcher')] }, async (request, reply) => {
    const body = createOrderSchema.parse(request.body);
    const order = await createOrder(request.user.tenantId, body);
    reply.code(201).send(order);
  });

  app.get('/', async (request) => {
    const query = paginationSchema.parse(request.query);
    const { status } = request.query as { status?: string };
    return listOrders(request.user.tenantId, query, status);
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
    const { orders: orderRows } = request.body as { orders: Array<Record<string, string>> };
    const result = await importOrdersCsv(request.user.tenantId, orderRows);
    reply.code(201).send(result);
  });
}
