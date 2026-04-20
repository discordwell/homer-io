import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────
// The SSRF check runs BEFORE the DB is touched, so we only need a stub DB.

vi.mock('../lib/db/index.js', () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([{ id: 'stub', createdAt: new Date(), secret: 'x', url: 'https://example.com', events: [], failureCount: 0, lastSuccessAt: null, lastFailureAt: null, description: null, isActive: true }])),
      })),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([])),
        })),
      })),
    })),
  },
}));

vi.mock('../lib/activity.js', () => ({
  logActivity: vi.fn(async () => {}),
}));

vi.mock('../lib/webhooks.js', () => ({
  enqueueWebhook: vi.fn(async () => {}),
  enqueueWebhookDelivery: vi.fn(async () => {}),
}));

vi.mock('../config.js', () => ({
  config: {
    nodeEnv: 'test',
    cors: { origin: ['http://localhost:3000'] },
    integrations: { encryptionKey: 'test-key' },
  },
}));

// Mock DNS so that "private.attacker.com" resolves to a private IP.
vi.mock('dns', async () => {
  const actual = await vi.importActual<typeof import('dns')>('dns');
  return {
    ...actual,
    promises: {
      lookup: vi.fn(async (hostname: string) => {
        if (hostname === 'private.attacker.com') {
          return [{ address: '10.0.0.5', family: 4 }];
        }
        if (hostname.endsWith('.myshopify.com') || hostname === 'public.example.com') {
          return [{ address: '8.8.8.8', family: 4 }];
        }
        throw new Error('ENOTFOUND (mocked)');
      }),
    },
  };
});

// For integrations: avoid the connector actually making network calls.
// The SSRF check runs before validateCredentials, so this should never be
// called on the reject paths — but stub it anyway for safety.
vi.mock('../lib/integrations/index.js', () => ({
  encrypt: vi.fn((v: string) => v),
  decrypt: vi.fn((v: string) => v),
  getConnector: vi.fn(() => ({
    platform: 'shopify',
    validateCredentials: vi.fn(async () => true),
    registerWebhooks: vi.fn(async () => []),
    fetchOrders: vi.fn(async () => []),
    mapOrderToHomer: vi.fn(),
  })),
  getAvailablePlatforms: vi.fn(() => []),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Webhook create: SSRF rejection ───────────────────────────────────────────

describe('Webhook createEndpoint — SSRF rejection at create-time', () => {
  it('rejects a webhook URL pointing at a literal private IP', async () => {
    const { createEndpoint } = await import('../modules/webhooks/service.js');
    await expect(
      createEndpoint('tenant-1', 'user-1', {
        url: 'https://192.168.1.1/webhook',
        events: ['order.delivered'],
        description: null,
      } as any),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringMatching(/Invalid URL/i),
    });
  });

  it('rejects a webhook URL pointing at the AWS metadata service', async () => {
    const { createEndpoint } = await import('../modules/webhooks/service.js');
    await expect(
      createEndpoint('tenant-1', 'user-1', {
        url: 'https://169.254.169.254/latest/meta-data/',
        events: ['order.delivered'],
        description: null,
      } as any),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects an HTTP (non-HTTPS) webhook URL', async () => {
    const { createEndpoint } = await import('../modules/webhooks/service.js');
    // Note: the shared zod schema also rejects http:// at the parser level,
    // but the service-level check must ALSO catch it for defense-in-depth in
    // case callers bypass the schema.
    await expect(
      createEndpoint('tenant-1', 'user-1', {
        url: 'http://example.com/webhook',
        events: ['order.delivered'],
        description: null,
      } as any),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects a webhook URL whose hostname DNS-resolves to a private IP', async () => {
    const { createEndpoint } = await import('../modules/webhooks/service.js');
    await expect(
      createEndpoint('tenant-1', 'user-1', {
        url: 'https://private.attacker.com/webhook',
        events: ['order.delivered'],
        description: null,
      } as any),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

// ── Integration create: SSRF + allow-list rejection ──────────────────────────

describe('Integration createConnection — storeUrl validation', () => {
  it('rejects a Shopify storeUrl that is not *.myshopify.com', async () => {
    const { createConnection } = await import('../modules/integrations/service.js');
    await expect(
      createConnection('tenant-1', 'user-1', {
        platform: 'shopify' as const,
        storeUrl: 'https://attacker.com',
        credentials: { apiKey: 'k', password: 'p' },
        autoImport: true,
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringMatching(/Invalid URL|myshopify/i),
    });
  });

  it('rejects a storeUrl pointing at a private IP', async () => {
    const { createConnection } = await import('../modules/integrations/service.js');
    await expect(
      createConnection('tenant-1', 'user-1', {
        // woocommerce has no canonical-host restriction, but private IPs are
        // still blocked by the generic safe-url check.
        platform: 'woocommerce' as const,
        storeUrl: 'https://10.0.0.1/',
        credentials: { consumerKey: 'k', consumerSecret: 's' },
        autoImport: true,
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects a storeUrl that DNS-resolves to a private IP', async () => {
    const { createConnection } = await import('../modules/integrations/service.js');
    await expect(
      createConnection('tenant-1', 'user-1', {
        platform: 'woocommerce' as const,
        storeUrl: 'https://private.attacker.com/',
        credentials: { consumerKey: 'k', consumerSecret: 's' },
        autoImport: true,
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects Shopify even with a valid-looking myshopify-like suffix-trick', async () => {
    const { createConnection } = await import('../modules/integrations/service.js');
    await expect(
      createConnection('tenant-1', 'user-1', {
        platform: 'shopify' as const,
        storeUrl: 'https://myshopify.com.attacker.com',
        credentials: { apiKey: 'k', password: 'p' },
        autoImport: true,
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});
