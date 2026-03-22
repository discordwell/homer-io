import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { createManifestSchema, updateCannabisSettingsSchema, idVerificationInputSchema } from '@homer-io/shared';
import { authenticate, requireRole } from '../../plugins/auth.js';
import { db } from '../../lib/db/index.js';
import { orders } from '../../lib/db/schema/orders.js';
import {
  getCannabisSettings, updateCannabisSettings, requireCannabisIndustry,
  createManifest, getManifest, listManifests, completeManifest, voidManifest, activateManifest,
  verifyAge, validateIdMatch,
} from './service.js';
import { uploadPodFiles } from '../pod/service.js';

const listManifestsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  routeId: z.string().uuid().optional(),
});

// Industry gate — reusable preHandler
async function requireCannabis(request: FastifyRequest, reply: FastifyReply) {
  try {
    await requireCannabisIndustry(request.user.tenantId);
  } catch (err) {
    return reply.forbidden('This feature requires the cannabis industry');
  }
}

export async function cannabisRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);
  app.addHook('preHandler', requireCannabis);

  // ── Settings ────────────────────────────────────────────────────────

  app.get('/settings', { preHandler: [requireRole('admin')] }, async (request) => {
    const settings = await getCannabisSettings(request.user.tenantId);
    return settings ?? {};
  });

  app.put('/settings', { preHandler: [requireRole('owner')] }, async (request) => {
    const input = updateCannabisSettingsSchema.parse(request.body);
    return updateCannabisSettings(request.user.tenantId, input, request.user.id);
  });

  // ── Manifests ───────────────────────────────────────────────────────

  app.post('/manifests', { preHandler: [requireRole('dispatcher')] }, async (request) => {
    const input = createManifestSchema.parse(request.body);
    return createManifest(request.user.tenantId, input, request.user.id);
  });

  app.get('/manifests', { preHandler: [requireRole('dispatcher')] }, async (request) => {
    const query = listManifestsQuery.parse(request.query);
    return listManifests(request.user.tenantId, query);
  });

  app.get('/manifests/:id', { preHandler: [requireRole('driver')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const manifest = await getManifest(request.user.tenantId, id);
    if (!manifest) return reply.notFound('Manifest not found');
    return manifest;
  });

  app.get('/manifests/:id/pdf', { preHandler: [requireRole('driver')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const manifest = await getManifest(request.user.tenantId, id);
    if (!manifest) return reply.notFound('Manifest not found');
    if (!manifest.pdfUrl) return reply.notFound('PDF not yet generated');
    return { pdfUrl: manifest.pdfUrl };
  });

  app.post('/manifests/:id/activate', { preHandler: [requireRole('dispatcher')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const updated = await activateManifest(request.user.tenantId, id, request.user.id);
    if (!updated) return reply.notFound('Manifest not found');
    return updated;
  });

  app.post('/manifests/:id/complete', { preHandler: [requireRole('dispatcher')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const updated = await completeManifest(request.user.tenantId, id, request.user.id);
    if (!updated) return reply.notFound('Manifest not found');
    return updated;
  });

  app.post('/manifests/:id/void', { preHandler: [requireRole('admin')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const updated = await voidManifest(request.user.tenantId, id, request.user.id);
    if (!updated) return reply.notFound('Manifest not found');
    return updated;
  });

  // ── ID Verification ────────────────────────────────────────────────

  app.post('/verify-id', { preHandler: [requireRole('driver')] }, async (request, reply) => {
    const input = idVerificationInputSchema.parse(request.body);
    const settings = await getCannabisSettings(request.user.tenantId);
    const minimumAge = settings?.minimumAge ?? 21;

    // Fetch order to get recipient name for comparison
    const [order] = await db.select({ recipientName: orders.recipientName })
      .from(orders)
      .where(and(eq(orders.id, input.orderId), eq(orders.tenantId, request.user.tenantId)))
      .limit(1);
    if (!order) return reply.notFound('Order not found');

    // Verify age
    const ageResult = verifyAge(input.idDob, minimumAge);

    // Check ID expiration
    const idExpired = new Date(input.idExpirationDate) < new Date();

    // Check name match against order recipient
    const nameResult = validateIdMatch(input.idNameOnId, order.recipientName);

    // Truncate ID number to last 4 for storage
    const truncatedIdNumber = input.idNumber.slice(-4);

    // Upload ID photo
    const [idPhotoUrl] = await uploadPodFiles(request.user.tenantId, input.orderId, [{
      data: input.idPhotoBase64,
      filename: `id-${Date.now()}.jpg`,
      contentType: 'image/jpeg',
    }]);

    return {
      ageVerified: ageResult.verified && !idExpired,
      age: ageResult.age,
      minimumAge,
      idExpired,
      nameMatch: nameResult.match,
      nameConfidence: nameResult.confidence,
      idNumber: truncatedIdNumber,
      idPhotoUrl,
      idVerifiedAt: new Date().toISOString(),
    };
  });
}
