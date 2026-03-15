import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createPodSchema } from '@homer-io/shared';
import { authenticate, requireRole } from '../../plugins/auth.js';
import { uploadPodFiles, createPod, getPod } from './service.js';

const uploadSchema = z.object({
  orderId: z.string().uuid(),
  files: z.array(z.object({
    data: z.string(),
    filename: z.string(),
    contentType: z.string(),
  })).min(1).max(5),
});

export async function podRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  // POST /api/pod/upload — upload POD files (base64-encoded)
  app.post('/upload', { preHandler: [requireRole('driver')] }, async (request, reply) => {
    const body = uploadSchema.parse(request.body);
    const { tenantId } = request.user;
    const urls = await uploadPodFiles(tenantId, body.orderId, body.files);
    reply.code(201).send({ urls });
  });

  // POST /api/pod/:orderId — create a POD record
  app.post('/:orderId', { preHandler: [requireRole('driver')] }, async (request, reply) => {
    const { orderId } = request.params as { orderId: string };
    const body = createPodSchema.parse(request.body);
    const { tenantId, id: userId } = request.user;
    const pod = await createPod(tenantId, userId, orderId, body);
    reply.code(201).send(pod);
  });

  // GET /api/pod/:orderId — view POD (dispatcher+ or the capturing driver)
  app.get('/:orderId', async (request) => {
    const { orderId } = request.params as { orderId: string };
    const { tenantId } = request.user;
    return getPod(tenantId, orderId);
  });
}
