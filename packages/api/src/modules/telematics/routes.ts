import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, requireRole, denyDemo } from '../../plugins/auth.js';
import {
  listAvailableProviders,
  startConnect,
  completeConnect,
  listConnections,
  getConnection,
  disconnect,
  listExternalVehiclesWithSuggestions,
  linkExternalVehicle,
  ingestWebhook,
} from './service.js';
import type { TelematicsProvider } from '../../lib/telematics/index.js';
import { config } from '../../config.js';

const providerParam = z.object({ provider: z.enum(['samsara', 'motive', 'geotab']) });
const connectionParam = z.object({ id: z.string().uuid() });

const startConnectBody = z.object({
  redirectUri: z.string().url().optional(),
}).optional();

const completeConnectBody = z.object({
  state: z.string(),
  code: z.string().optional(),
  credentials: z.record(z.string(), z.string()).optional(),
  redirectUri: z.string().url().optional(),
});

const linkBody = z.object({
  externalVehicleId: z.string(),
  homerVehicleId: z.string().uuid().nullable(),
});

/**
 * Default OAuth redirect — frontend route that captures ?code&state and POSTs
 * back to /connect/:provider/complete.
 */
function defaultRedirectUri(): string {
  return `${config.app.frontendUrl}/settings/telematics/callback`;
}

export async function telematicsRoutes(app: FastifyInstance) {
  // Most telematics routes require an authenticated admin in a non-demo tenant.
  app.addHook('preHandler', authenticate);

  // GET /providers — catalog for the UI
  app.get('/providers', { preHandler: [requireRole('admin')] }, async () => {
    return listAvailableProviders();
  });

  // GET /connections
  app.get('/connections', { preHandler: [requireRole('admin')] }, async (req) => {
    return listConnections(req.user.tenantId);
  });

  // GET /connections/:id
  app.get('/connections/:id', { preHandler: [requireRole('admin')] }, async (req) => {
    const { id } = connectionParam.parse(req.params);
    return getConnection(req.user.tenantId, id);
  });

  // DELETE /connections/:id
  app.delete('/connections/:id', { preHandler: [requireRole('admin'), denyDemo] }, async (req, reply) => {
    const { id } = connectionParam.parse(req.params);
    await disconnect(req.user.tenantId, id);
    reply.code(204).send();
  });

  // POST /connect/:provider/start — returns OAuth URL or field spec
  app.post('/connect/:provider/start', { preHandler: [requireRole('admin'), denyDemo] }, async (req) => {
    const { provider } = providerParam.parse(req.params);
    const body = startConnectBody.parse(req.body);
    const redirectUri = body?.redirectUri ?? defaultRedirectUri();
    return startConnect(req.user.tenantId, provider as TelematicsProvider, redirectUri);
  });

  // POST /connect/:provider/complete — finishes OAuth or stores API key
  app.post('/connect/:provider/complete', { preHandler: [requireRole('admin'), denyDemo] }, async (req) => {
    const { provider } = providerParam.parse(req.params);
    const body = completeConnectBody.parse(req.body);
    return completeConnect({
      tenantId: req.user.tenantId,
      provider: provider as TelematicsProvider,
      state: body.state,
      code: body.code,
      redirectUri: body.redirectUri ?? defaultRedirectUri(),
      credentials: body.credentials,
    });
  });

  // GET /connections/:id/vehicles — external + Homer auto-suggest
  app.get('/connections/:id/vehicles', { preHandler: [requireRole('admin')] }, async (req) => {
    const { id } = connectionParam.parse(req.params);
    return listExternalVehiclesWithSuggestions(req.user.tenantId, id);
  });

  // POST /connections/:id/vehicles/link
  app.post('/connections/:id/vehicles/link', { preHandler: [requireRole('admin'), denyDemo] }, async (req, reply) => {
    const { id } = connectionParam.parse(req.params);
    const body = linkBody.parse(req.body);
    await linkExternalVehicle(req.user.tenantId, id, body.externalVehicleId, body.homerVehicleId);
    reply.code(204).send();
  });
}

/**
 * Public webhook ingest routes — signature-verified, no JWT auth.
 * Registered separately so the authenticate hook doesn't apply.
 *
 * SECURITY: HMAC verification requires the byte-exact request body as
 * delivered by the provider. Fastify's default JSON parser would reorder
 * keys / normalize whitespace, breaking the signature. We register a
 * raw-body content-type parser scoped to this plugin that stores the
 * Buffer unchanged, mirroring the Stripe webhook plugin pattern.
 */
export async function telematicsWebhookRoutes(app: FastifyInstance) {
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (_req, body, done) => { done(null, body); },
  );

  const webhookParam = z.object({
    provider: z.enum(['samsara', 'motive', 'geotab']),
    connectionId: z.string().uuid(),
  });

  app.post('/:provider/:connectionId', async (req, reply) => {
    const { provider, connectionId } = webhookParam.parse(req.params);
    const rawBody = Buffer.isBuffer(req.body)
      ? req.body.toString('utf8')
      : typeof req.body === 'string'
        ? req.body
        // Fallback for test harnesses that don't flow through the raw parser.
        : JSON.stringify(req.body);
    const headers: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(req.headers)) {
      headers[k.toLowerCase()] = Array.isArray(v) ? v[0] : v;
    }
    try {
      const result = await ingestWebhook(provider as TelematicsProvider, connectionId, rawBody, headers);
      reply.code(200).send({ accepted: result.accepted });
    } catch (err) {
      // Surface 400 on signature / parse failures; don't leak internals.
      const message = err instanceof Error ? err.message : 'webhook rejected';
      reply.code(400).send({ error: message });
    }
  });
}
