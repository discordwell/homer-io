import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';

// Mocks — the route under test calls requestDataExport; we drive this mock
// directly per-test to simulate success, 409 in-progress, or service errors
// without touching the DB layer.
const mockRequestDataExport = vi.fn();

vi.mock('../modules/gdpr/service.js', () => ({
  requestDataExport: (...args: unknown[]) => mockRequestDataExport(...args),
  getExportStatus: vi.fn(),
  listExportRequests: vi.fn(),
  requestAccountDeletion: vi.fn(),
  confirmDeletion: vi.fn(),
  cancelDeletion: vi.fn(),
  listDeletionRequests: vi.fn(),
}));

// Auth plugin is mocked to inject a fixed user — focuses the test on rate
// limiting and the in-progress gate, not on JWT parsing.
vi.mock('../plugins/auth.js', () => ({
  authenticate: async (request: { user: { id: string; tenantId: string; role: string; email: string } }) => {
    // Allow tests to override via a header — default to a single test user.
    const headers = (request as unknown as { headers: Record<string, string> }).headers;
    const uid = headers['x-test-user-id'] || 'user-1';
    const tid = headers['x-test-tenant-id'] || 'tenant-1';
    request.user = { id: uid, tenantId: tid, role: 'owner', email: `${uid}@example.test` };
  },
  requireRole: () => async () => {
    // No-op: the injected user above is always owner for these tests.
  },
}));

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(sensible);
  // Mirror server.ts: a base rate-limit plugin so the sub-scope's limiter
  // attaches correctly. We use a huge max here to avoid interference with
  // the sub-scoped 1/hour limiter under test.
  await app.register(rateLimit, { global: false, max: 10_000, timeWindow: '1 minute' });
  // Dynamically import AFTER mocks are registered.
  const { gdprRoutes } = await import('../modules/gdpr/routes.js');
  await app.register(gdprRoutes, { prefix: '/api/gdpr' });
  return app;
}

describe('GDPR /export — per-user rate limit (1 per hour)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('first request succeeds, second back-to-back by same user is 429', async () => {
    // Service returns success both times; the rate limiter — not the service
    // layer — must block the second call.
    mockRequestDataExport.mockResolvedValue({ id: 'exp-1', status: 'queued' });

    const app = await buildApp();
    try {
      const first = await app.inject({
        method: 'POST',
        url: '/api/gdpr/export',
        headers: { 'x-test-user-id': 'u-rate-1' },
      });
      expect(first.statusCode).toBe(201);
      expect(first.json()).toMatchObject({ id: 'exp-1', status: 'queued' });

      const second = await app.inject({
        method: 'POST',
        url: '/api/gdpr/export',
        headers: { 'x-test-user-id': 'u-rate-1' },
      });
      expect(second.statusCode).toBe(429);
      // Service should only have been called once — the rate limiter short-
      // circuited the second request before the handler ran.
      expect(mockRequestDataExport).toHaveBeenCalledTimes(1);
    } finally {
      await app.close();
    }
  });

  it('different users each get their own bucket (second user NOT limited by first)', async () => {
    // Rate limit is per-user, not per-IP or global: a second legitimate owner
    // on the same tenant should not be blocked by the first user's request.
    mockRequestDataExport.mockResolvedValue({ id: 'exp-a', status: 'queued' });

    const app = await buildApp();
    try {
      const a = await app.inject({
        method: 'POST',
        url: '/api/gdpr/export',
        headers: { 'x-test-user-id': 'u-iso-A' },
      });
      expect(a.statusCode).toBe(201);

      const b = await app.inject({
        method: 'POST',
        url: '/api/gdpr/export',
        headers: { 'x-test-user-id': 'u-iso-B' },
      });
      expect(b.statusCode).toBe(201);
      expect(mockRequestDataExport).toHaveBeenCalledTimes(2);
    } finally {
      await app.close();
    }
  });

  it('returns 409 when service reports in-progress export (different gate than rate limit)', async () => {
    // Simulates the tenant-scoped gate firing: the per-user rate limit hasn't
    // kicked in yet (fresh user), but another owner of the same tenant has
    // already queued an export. The service throws 409 "Export already in
    // progress" and the handler propagates it.
    const { HttpError } = await import('../lib/errors.js');
    mockRequestDataExport.mockRejectedValueOnce(new HttpError(409, 'Export already in progress'));

    const app = await buildApp();
    // Add the same error handler shape as server.ts so HttpError maps to a
    // proper status code in the test harness.
    app.setErrorHandler((error, _request, reply) => {
      const err = error as { statusCode?: number; message?: string; constructor?: { name: string } };
      if (typeof err.statusCode === 'number') {
        return reply.status(err.statusCode).send({
          statusCode: err.statusCode,
          error: err.constructor?.name || 'Error',
          message: err.message,
        });
      }
      return reply.status(500).send({ error: 'Internal Server Error' });
    });

    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/gdpr/export',
        headers: { 'x-test-user-id': 'u-inprog' },
      });
      expect(res.statusCode).toBe(409);
      expect(res.json()).toMatchObject({ message: 'Export already in progress' });
    } finally {
      await app.close();
    }
  });

  it('happy path: single export returns 201 and the created record', async () => {
    // Regression guard — the rate-limit wrapper must not break normal success.
    mockRequestDataExport.mockResolvedValue({
      id: 'exp-happy',
      tenantId: 'tenant-1',
      requestedBy: 'u-happy',
      status: 'queued',
    });

    const app = await buildApp();
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/gdpr/export',
        headers: { 'x-test-user-id': 'u-happy' },
      });
      expect(res.statusCode).toBe(201);
      expect(res.json()).toMatchObject({ id: 'exp-happy', status: 'queued' });
      // Service was called with (tenantId, userId) in that order.
      expect(mockRequestDataExport).toHaveBeenCalledWith('tenant-1', 'u-happy');
    } finally {
      await app.close();
    }
  });
});
