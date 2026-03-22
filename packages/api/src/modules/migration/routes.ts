import { FastifyInstance } from 'fastify';
import { createMigrationJobSchema, validateMigrationCredentialsSchema } from '@homer-io/shared';
import { authenticate, requireRole, denyDemo } from '../../plugins/auth.js';
import {
  createMigrationJob,
  listMigrationJobs,
  getMigrationJob,
  cancelMigrationJob,
  deleteMigrationJob,
  validateMigrationCredentials,
  getMigrationPlatformInfo,
} from './service.js';

export async function migrationRoutes(app: FastifyInstance) {
  // ─── Static routes first (before parameterized) ─────────────────────────────

  // POST /validate — Test API credentials and return counts
  app.post('/validate', {
    preHandler: [authenticate, requireRole('admin'), denyDemo],
  }, async (request, reply) => {
    const body = validateMigrationCredentialsSchema.parse(request.body);
    const result = await validateMigrationCredentials(body.platform, body.apiKey);
    reply.send(result);
  });

  // GET /platforms — Return platform capabilities
  app.get('/platforms', {
    preHandler: [authenticate, requireRole('admin')],
  }, async (_request, reply) => {
    reply.send(getMigrationPlatformInfo());
  });

  // ─── Collection routes ──────────────────────────────────────────────────────

  // POST / — Create a new migration job
  app.post('/', {
    preHandler: [authenticate, requireRole('admin'), denyDemo],
    bodyLimit: 10 * 1024 * 1024, // 10MB for CSV data
  }, async (request, reply) => {
    const body = createMigrationJobSchema.parse(request.body);
    const result = await createMigrationJob(
      request.user.tenantId,
      request.user.id,
      body,
    );
    reply.code(201).send(result);
  });

  // GET / — List migration jobs (paginated)
  app.get('/', {
    preHandler: [authenticate, requireRole('admin')],
  }, async (request, reply) => {
    const query = request.query as { page?: string; limit?: string };
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const result = await listMigrationJobs(request.user.tenantId, page, limit);
    reply.send(result);
  });

  // ─── Parameterized routes ───────────────────────────────────────────────────

  // GET /:id — Get single migration job with progress
  app.get('/:id', {
    preHandler: [authenticate, requireRole('admin')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await getMigrationJob(request.user.tenantId, id);
    reply.send(result);
  });

  // POST /:id/cancel — Cancel a pending/in_progress job
  app.post('/:id/cancel', {
    preHandler: [authenticate, requireRole('admin'), denyDemo],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await cancelMigrationJob(request.user.tenantId, id);
    reply.send(result);
  });

  // DELETE /:id — Delete a completed/failed/cancelled job
  app.delete('/:id', {
    preHandler: [authenticate, requireRole('admin'), denyDemo],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await deleteMigrationJob(request.user.tenantId, id);
    reply.code(204).send();
  });
}
