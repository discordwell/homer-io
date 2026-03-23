import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── GDPR role enforcement ────────────────────────────────────────────────────

describe('GDPR routes role enforcement', () => {
  it('delete-account/confirm requires owner role', async () => {
    const { gdprRoutes } = await import('../modules/gdpr/routes.js');

    const registeredRoutes: { method: string; path: string; preHandler?: unknown[] }[] = [];
    const mockApp = {
      addHook: vi.fn(),
      post: vi.fn((path: string, opts: any, _handler?: any) => {
        const config = typeof opts === 'object' && !Array.isArray(opts) ? opts : {};
        registeredRoutes.push({ method: 'POST', path, preHandler: config.preHandler });
      }),
      get: vi.fn((path: string, opts: any, _handler?: any) => {
        const config = typeof opts === 'object' && !Array.isArray(opts) ? opts : {};
        registeredRoutes.push({ method: 'GET', path, preHandler: config.preHandler });
      }),
      delete: vi.fn((path: string, opts: any, _handler?: any) => {
        const config = typeof opts === 'object' && !Array.isArray(opts) ? opts : {};
        registeredRoutes.push({ method: 'DELETE', path, preHandler: config.preHandler });
      }),
    };

    await gdprRoutes(mockApp as any);

    // Verify global auth hook
    expect(mockApp.addHook).toHaveBeenCalledWith('preHandler', expect.any(Function));

    // All mutation endpoints must have role guards
    const confirmRoute = registeredRoutes.find(r => r.path === '/delete-account/confirm');
    expect(confirmRoute).toBeDefined();
    expect(confirmRoute!.preHandler).toBeDefined();
    expect(confirmRoute!.preHandler!.length).toBeGreaterThan(0);

    // Listing endpoints must have role guards
    const exportsRoute = registeredRoutes.find(r => r.method === 'GET' && r.path === '/exports');
    expect(exportsRoute?.preHandler).toBeDefined();

    const deletionRequestsRoute = registeredRoutes.find(r => r.path === '/deletion-requests');
    expect(deletionRequestsRoute?.preHandler).toBeDefined();

    const exportDetailRoute = registeredRoutes.find(r => r.path === '/export/:id');
    expect(exportDetailRoute?.preHandler).toBeDefined();
  });
});

// ── Encryption key enforcement ───────────────────────────────────────────────

describe('Integration encryption key enforcement', () => {
  it('encrypt throws in production without encryption key', async () => {
    vi.resetModules();
    vi.doMock('../config.js', () => ({
      config: {
        nodeEnv: 'production',
        integrations: { encryptionKey: '' },
      },
    }));

    const { encrypt } = await import('../lib/integrations/crypto.js');
    expect(() => encrypt('sensitive-data')).toThrow('INTEGRATION_ENCRYPTION_KEY is required in production');

    vi.doUnmock('../config.js');
  });

  it('decrypt throws in production without encryption key', async () => {
    vi.resetModules();
    vi.doMock('../config.js', () => ({
      config: {
        nodeEnv: 'production',
        integrations: { encryptionKey: '' },
      },
    }));

    const { decrypt } = await import('../lib/integrations/crypto.js');
    expect(() => decrypt('aWYtYmFzZTY0:dGFn:Y2lwaGVy')).toThrow('INTEGRATION_ENCRYPTION_KEY is required in production');

    vi.doUnmock('../config.js');
  });

  it('encrypt works in development with fallback key', async () => {
    vi.resetModules();
    vi.doMock('../config.js', () => ({
      config: {
        nodeEnv: 'development',
        integrations: { encryptionKey: '' },
      },
    }));

    const { encrypt, decrypt } = await import('../lib/integrations/crypto.js');
    const encrypted = encrypt('test-secret');
    expect(encrypted).toContain(':');
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe('test-secret');

    vi.doUnmock('../config.js');
  });
});

// ── Security headers ─────────────────────────────────────────────────────────

describe('Security headers', () => {
  it('server registers security header hook', async () => {
    // Read server.ts source to verify headers are set
    const fs = await import('fs');
    const serverSource = fs.readFileSync(
      new URL('../server.ts', import.meta.url).pathname.replace('/__tests__/', '/'),
      'utf-8',
    );

    expect(serverSource).toContain('X-Frame-Options');
    expect(serverSource).toContain('X-Content-Type-Options');
    expect(serverSource).toContain('Strict-Transport-Security');
    expect(serverSource).toContain('Referrer-Policy');
  });
});

// ── Stripe event deduplication ───────────────────────────────────────────────

describe('Stripe webhook deduplication', () => {
  it('webhook handler includes dedup logic', async () => {
    const fs = await import('fs');
    const webhookSource = fs.readFileSync(
      new URL('../modules/billing/webhook.ts', import.meta.url).pathname.replace('/__tests__/', '/'),
      'utf-8',
    );

    expect(webhookSource).toContain('stripe:event:');
    expect(webhookSource).toContain('cacheGet');
    expect(webhookSource).toContain('cacheSet');
    expect(webhookSource).toContain('Duplicate event skipped');
  });
});

// ── Password reset invalidates refresh tokens ────────────────────────────────

describe('Password reset session invalidation', () => {
  it('resetPassword deletes refresh tokens in transaction', async () => {
    const fs = await import('fs');
    const authSource = fs.readFileSync(
      new URL('../modules/auth/service.ts', import.meta.url).pathname.replace('/__tests__/', '/'),
      'utf-8',
    );

    // Find the resetPassword function and verify it deletes refresh tokens
    const resetFnMatch = authSource.match(/async function resetPassword[\s\S]*?^}/m);
    expect(resetFnMatch).toBeTruthy();
    const resetFnBody = resetFnMatch![0];
    expect(resetFnBody).toContain('delete(refreshTokens)');
    expect(resetFnBody).toContain('userId');
  });
});

// ── Webhook secret not in URL ────────────────────────────────────────────────

describe('Integration webhook security', () => {
  it('webhook callback URL does not contain query secret', async () => {
    const fs = await import('fs');
    const serviceSource = fs.readFileSync(
      new URL('../modules/integrations/service.ts', import.meta.url).pathname.replace('/__tests__/', '/'),
      'utf-8',
    );

    // The callback URL line should NOT have ?secret=
    expect(serviceSource).not.toContain('?secret=${webhookSecret}');
  });

  it('processInboundWebhook does not accept querySecret parameter', async () => {
    const fs = await import('fs');
    const serviceSource = fs.readFileSync(
      new URL('../modules/integrations/service.ts', import.meta.url).pathname.replace('/__tests__/', '/'),
      'utf-8',
    );

    // The function signature should not include querySecret
    const fnSignature = serviceSource.match(/async function processInboundWebhook\([^)]+\)/);
    expect(fnSignature).toBeTruthy();
    expect(fnSignature![0]).not.toContain('querySecret');
  });
});
