/**
 * Regression tests for the M3/L2/L4/L5/M4 backend-hardening sweep.
 *
 *   M3 — orders list endpoint must not overfetch heavy JSONB columns.
 *   L2 — throws use HttpError, not Object.assign(new Error, { statusCode }).
 *   L4 — Shopify connector must not embed basic-auth in the URL.
 *   L5 — audit `TODAY` must track the current date, not a stale literal.
 *   M4 — resetPassword must invalidate outstanding email-link tokens and
 *        unused password-reset tokens for that user.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { HttpError } from '../lib/errors.js';

function readSource(relFromApiSrc: string): string {
  // resolve relative to the /src root (we live in /src/__tests__)
  const url = new URL(`../${relFromApiSrc}`, import.meta.url);
  // vitest on node: use pathname, but tests live in /src/__tests__/ so callers
  // pass paths relative to /src (e.g. "modules/orders/service.ts").
  return readFileSync(url.pathname.replace('/__tests__/', '/'), 'utf8');
}

// ---------------------------------------------------------------------------
// M3 — orders list overfetch
// ---------------------------------------------------------------------------
describe('M3 — orders listOrders does not overfetch', () => {
  it('explicitly selects only the columns the list UI/store consumes', () => {
    const src = readSource('modules/orders/service.ts');

    // Isolate the listOrders function body.
    const listOrdersSection = src.slice(
      src.indexOf('export async function listOrders'),
      src.indexOf('export async function getOrder'),
    );
    expect(listOrdersSection).toMatch(/db\.select\(listColumns\)\.from\(orders\)/);
    expect(listOrdersSection).not.toMatch(/db\.select\(\)\.from\(orders\)/);

    // Heavy JSONB / PHI columns must NOT appear in the list projection.
    const listColumnsBlock = src.slice(
      src.indexOf('const listColumns'),
      src.indexOf('const [items, countResult]'),
    );
    for (const banned of ['pickupAddress', 'barcodes', 'customFields', 'hipaaSafeNotes']) {
      expect(listColumnsBlock).not.toContain(banned);
    }
    for (const needed of [
      'id',
      'recipientName',
      'status',
      'createdAt',
      'deliveryAddress',
      'priority',
      'packageCount',
      'externalId',
      'routeId',
    ]) {
      expect(listColumnsBlock).toContain(needed);
    }
  });
});

// ---------------------------------------------------------------------------
// L2 — HttpError canonicalization
// ---------------------------------------------------------------------------
describe('L2 — services use HttpError instead of Object.assign(new Error, { statusCode })', () => {
  it('HttpError carries the numeric statusCode and extends Error', () => {
    const e = new HttpError(422, 'bad');
    expect(e).toBeInstanceOf(Error);
    expect(e).toBeInstanceOf(HttpError);
    expect(e.statusCode).toBe(422);
    expect(e.message).toBe('bad');
  });

  it('no service module uses the `Object.assign(new Error, { statusCode })` antipattern', () => {
    const modulesWithOldPattern: string[] = [];
    const files = [
      'modules/orders/service.ts',
      'modules/cannabis/service.ts',
      'modules/pharmacy/service.ts',
    ];
    for (const rel of files) {
      const src = readSource(rel);
      if (/Object\.assign\(\s*new Error\b[\s\S]*?statusCode\s*:/.test(src)) {
        modulesWithOldPattern.push(rel);
      }
    }
    expect(modulesWithOldPattern).toEqual([]);
  });

  it('cannabis requireCannabisIndustry throws HttpError(403) on non-cannabis tenants', async () => {
    vi.resetModules();
    vi.doMock('../lib/db/index.js', () => ({
      db: {
        select: () => ({
          from: () => ({
            where: () => ({ limit: async () => [{ industry: 'florist' }] }),
          }),
        }),
      },
    }));
    vi.doMock('../lib/db/schema/tenants.js', () => ({
      tenants: { id: 'id', industry: 'industry' },
    }));

    const { requireCannabisIndustry } = await import('../modules/cannabis/service.js');
    const { HttpError: Err } = await import('../lib/errors.js');

    let caught: unknown;
    try {
      await requireCannabisIndustry('tenant-id');
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Err);
    expect((caught as InstanceType<typeof Err>).statusCode).toBe(403);

    vi.doUnmock('../lib/db/index.js');
    vi.doUnmock('../lib/db/schema/tenants.js');
    vi.resetModules();
  });
});

// ---------------------------------------------------------------------------
// L4 — Shopify credentials live in headers, not in the URL
// ---------------------------------------------------------------------------
describe('L4 — ShopifyConnector does not leak basic-auth credentials in the URL', () => {
  let capturedUrl: string | null = null;
  let capturedHeaders: Record<string, string> | null = null;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    capturedUrl = null;
    capturedHeaders = null;
    globalThis.fetch = vi.fn(async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      capturedUrl = typeof input === 'string' ? input : String(input);
      capturedHeaders = (init?.headers ?? {}) as Record<string, string>;
      return new Response('{}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as unknown as typeof fetch;
  });

  it('uses Authorization: Basic header for private-app creds and keeps the URL credential-free', async () => {
    const { ShopifyConnector } = await import('../lib/integrations/shopify.js');
    const connector = new ShopifyConnector();

    await connector.validateCredentials(
      { apiKey: 'my-private-key', password: 'super-secret-pw' },
      'https://shop.myshopify.com',
    );

    expect(capturedUrl).toBeTruthy();
    expect(capturedUrl!).not.toContain('my-private-key');
    expect(capturedUrl!).not.toContain('super-secret-pw');
    // No embedded "user:pass@host" credential pattern before the host.
    expect(capturedUrl!).not.toMatch(/:\/\/[^/]+:[^@]+@/);

    const headers = capturedHeaders as Record<string, string>;
    const authHeader = headers['Authorization'] ?? headers['authorization'];
    expect(authHeader).toBeTruthy();
    expect(authHeader.startsWith('Basic ')).toBe(true);

    const decoded = Buffer.from(authHeader.slice('Basic '.length), 'base64').toString('utf8');
    expect(decoded).toBe('my-private-key:super-secret-pw');

    globalThis.fetch = originalFetch;
  });

  it('uses X-Shopify-Access-Token header when an accessToken is provided (no Authorization header)', async () => {
    const { ShopifyConnector } = await import('../lib/integrations/shopify.js');
    const connector = new ShopifyConnector();

    await connector.validateCredentials(
      { accessToken: 'shpat_fake_token_xyz' },
      'https://shop.myshopify.com',
    );

    expect(capturedUrl).toBeTruthy();
    expect(capturedUrl!).not.toContain('shpat_fake_token_xyz');

    const headers = capturedHeaders as Record<string, string>;
    expect(headers['X-Shopify-Access-Token']).toBe('shpat_fake_token_xyz');
    expect(headers['Authorization']).toBeUndefined();
    expect(headers['authorization']).toBeUndefined();

    globalThis.fetch = originalFetch;
  });
});

// ---------------------------------------------------------------------------
// L5 — audit TODAY is live, not frozen to 2026-03-24
// ---------------------------------------------------------------------------
describe('L5 — audit config exports a live TODAY', () => {
  it('TODAY is the current ISO date (YYYY-MM-DD)', async () => {
    const url = new URL(
      '../../../../scripts/audit/lib/config.mjs',
      import.meta.url,
    );
    const mod = await import(url.href);
    const expected = new Date().toISOString().split('T')[0];
    expect(mod.TODAY).toBe(expected);
    // FROZEN_TODAY still available for any callers that need snapshot determinism.
    expect(mod.FROZEN_TODAY).toBe('2026-03-24');
  });
});

// ---------------------------------------------------------------------------
// M4 — resetPassword invalidates outstanding email-link and prior reset tokens
// ---------------------------------------------------------------------------
describe('M4 — resetPassword invalidates outstanding email-link tokens', () => {
  it('source shows emailVerificationToken is cleared inside the reset transaction', () => {
    const src = readSource('modules/auth/service.ts');
    const resetFn = src.match(/async function resetPassword[\s\S]*?^}/m);
    expect(resetFn).toBeTruthy();
    const body = resetFn![0];

    // Clears the email-verification / email-link token
    expect(body).toContain('emailVerificationToken: null');
    // Kills refresh tokens for all devices
    expect(body).toContain('delete(refreshTokens)');
    // Also marks the reset token used
    expect(body).toContain('passwordResetTokens');
  });

  it('resetPassword issues updates that clear emailVerificationToken and kill other reset tokens', async () => {
    vi.resetModules();

    const userUpdateCalls: Array<Record<string, unknown>> = [];
    const resetTokenUpdateCalls: Array<Record<string, unknown>> = [];
    const emailLinkTokenUpdateCalls: Array<Record<string, unknown>> = [];
    const refreshTokenDeleteCalls: Array<unknown> = [];

    const validResetToken = {
      id: 'rt-1',
      userId: 'user-1',
      tokenHash: 'hash',
      expiresAt: new Date(Date.now() + 3_600_000),
      usedAt: null,
      createdAt: new Date(),
    };

    const txStub = {
      update: (table: any) => ({
        set: (values: Record<string, unknown>) => ({
          where: async () => {
            if (table === passwordResetTokensStub) {
              resetTokenUpdateCalls.push(values);
            } else if (table === emailLinkTokensStub) {
              emailLinkTokenUpdateCalls.push(values);
            } else {
              userUpdateCalls.push(values);
            }
          },
        }),
      }),
      delete: (table: any) => ({
        where: async (cond: unknown) => {
          if (table === refreshTokensStub) refreshTokenDeleteCalls.push(cond);
        },
      }),
    };

    const usersStub = {
      id: 'id',
      passwordHash: 'password_hash',
      failedLoginAttempts: 'failed_login_attempts',
      lockedUntil: 'locked_until',
      emailVerificationToken: 'email_verification_token',
      updatedAt: 'updated_at',
    };
    const refreshTokensStub = {
      userId: 'user_id',
      tokenHash: 'token_hash',
    };
    const passwordResetTokensStub = {
      id: 'id',
      userId: 'user_id',
      tokenHash: 'token_hash',
      usedAt: 'used_at',
    };
    const emailLinkTokensStub = {
      id: 'id',
      userId: 'user_id',
      usedAt: 'used_at',
    };

    vi.doMock('../lib/db/index.js', () => ({
      db: {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: async () => [validResetToken],
            }),
          }),
        }),
        transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(txStub),
      },
    }));

    vi.doMock('../lib/db/schema/users.js', () => ({
      users: usersStub,
      refreshTokens: refreshTokensStub,
    }));
    vi.doMock('../lib/db/schema/password-reset-tokens.js', () => ({
      passwordResetTokens: passwordResetTokensStub,
    }));
    vi.doMock('../lib/db/schema/email-link-tokens.js', () => ({
      emailLinkTokens: emailLinkTokensStub,
    }));
    vi.doMock('../lib/db/schema/tenants.js', () => ({
      tenants: { id: 'id', isDemo: 'is_demo', industry: 'industry', settings: 'settings' },
    }));
    vi.doMock('argon2', () => ({
      hash: vi.fn().mockResolvedValue('hashed_new_password'),
      verify: vi.fn(),
    }));
    vi.doMock('../lib/email.js', () => ({
      sendTransactionalEmail: vi.fn().mockResolvedValue({ success: true }),
    }));
    vi.doMock('../config.js', () => ({
      config: {
        app: { frontendUrl: 'http://localhost:3001' },
        sendgrid: { apiKey: '', fromEmail: 'noreply@homer.io' },
      },
    }));
    vi.doMock('../modules/billing/service.js', () => ({
      createStripeCustomer: vi.fn().mockResolvedValue({}),
    }));

    const { resetPassword } = await import('../modules/auth/service.js');
    await resetPassword({} as any, 'plain-reset-token', 'brandNewPassword123');

    // The user row was updated and emailVerificationToken was cleared.
    expect(userUpdateCalls).toHaveLength(1);
    expect(userUpdateCalls[0]).toMatchObject({
      passwordHash: 'hashed_new_password',
      failedLoginAttempts: 0,
      emailVerificationToken: null,
    });

    // The password-reset-tokens update marks tokens as used (NOT just the one).
    expect(resetTokenUpdateCalls).toHaveLength(1);
    expect(resetTokenUpdateCalls[0]).toHaveProperty('usedAt');

    // Refresh tokens were deleted.
    expect(refreshTokenDeleteCalls).toHaveLength(1);

    // Email-link tokens (tenant-migration vector) were also invalidated —
    // see C5 hardening. A reset must kill any pending migration token.
    expect(emailLinkTokenUpdateCalls).toHaveLength(1);
    expect(emailLinkTokenUpdateCalls[0]).toHaveProperty('usedAt');

    vi.doUnmock('../lib/db/index.js');
    vi.doUnmock('../lib/db/schema/users.js');
    vi.doUnmock('../lib/db/schema/password-reset-tokens.js');
    vi.doUnmock('../lib/db/schema/email-link-tokens.js');
    vi.doUnmock('../lib/db/schema/tenants.js');
    vi.doUnmock('argon2');
    vi.doUnmock('../lib/email.js');
    vi.doUnmock('../config.js');
    vi.doUnmock('../modules/billing/service.js');
    vi.resetModules();
  });
});
