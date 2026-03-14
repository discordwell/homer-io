import { FastifyInstance } from 'fastify';
import { createVehicleSchema, createDriverSchema, paginationSchema } from '@homer-io/shared';
import { authenticate, requireRole } from '../../plugins/auth.js';
import {
  createVehicle, listVehicles, getVehicle, updateVehicle, deleteVehicle,
  createDriver, listDrivers, getDriver, updateDriver, deleteDriver,
} from './service.js';

export async function fleetRoutes(app: FastifyInstance) {
  // All fleet routes require authentication
  app.addHook('preHandler', authenticate);

  // ---- Vehicles ----
  app.post('/vehicles', { preHandler: [requireRole('admin')] }, async (request, reply) => {
    const body = createVehicleSchema.parse(request.body);
    const vehicle = await createVehicle(request.user.tenantId, body);
    reply.code(201).send(vehicle);
  });

  app.get('/vehicles', async (request) => {
    const query = paginationSchema.parse(request.query);
    return listVehicles(request.user.tenantId, query);
  });

  app.get('/vehicles/:id', async (request) => {
    const { id } = request.params as { id: string };
    return getVehicle(request.user.tenantId, id);
  });

  app.patch('/vehicles/:id', { preHandler: [requireRole('admin')] }, async (request) => {
    const { id } = request.params as { id: string };
    const body = createVehicleSchema.partial().parse(request.body);
    return updateVehicle(request.user.tenantId, id, body);
  });

  app.delete('/vehicles/:id', { preHandler: [requireRole('admin')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await deleteVehicle(request.user.tenantId, id);
    reply.code(204).send();
  });

  // ---- Drivers ----
  app.post('/drivers', { preHandler: [requireRole('admin')] }, async (request, reply) => {
    const body = createDriverSchema.parse(request.body);
    const driver = await createDriver(request.user.tenantId, body);
    reply.code(201).send(driver);
  });

  app.get('/drivers', async (request) => {
    const query = paginationSchema.parse(request.query);
    return listDrivers(request.user.tenantId, query);
  });

  app.get('/drivers/:id', async (request) => {
    const { id } = request.params as { id: string };
    return getDriver(request.user.tenantId, id);
  });

  app.patch('/drivers/:id', { preHandler: [requireRole('admin')] }, async (request) => {
    const { id } = request.params as { id: string };
    const body = createDriverSchema.partial().parse(request.body);
    return updateDriver(request.user.tenantId, id, body);
  });

  app.delete('/drivers/:id', { preHandler: [requireRole('admin')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await deleteDriver(request.user.tenantId, id);
    reply.code(204).send();
  });
}
