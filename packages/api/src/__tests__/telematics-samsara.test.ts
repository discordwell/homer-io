import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHmac } from 'crypto';

// Config mock — Samsara credentials required by basicAuthHeader() in adapter.
vi.mock('../config.js', () => ({
  config: {
    jwt: { secret: 'a'.repeat(32) },
    integrations: { encryptionKey: 'x'.repeat(32) },
    telematics: {
      samsara: {
        clientId: 'test-client',
        clientSecret: 'test-secret',
        webhookSigningSecret: Buffer.from('supersecretkey12345').toString('base64'),
      },
      motive: { clientId: '', clientSecret: '', webhookSigningSecret: '' },
      geotab: { clientId: '', clientSecret: '', webhookSigningSecret: '' },
    },
    app: { apiUrl: 'https://homer.test', frontendUrl: 'https://homer.test' },
  },
}));

// Logger — silence pino.
vi.mock('../lib/logger.js', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { samsaraAdapter } from '../lib/telematics/samsara.js';

function samsaraSig(rawBody: string, secret: string, timestamp: string): string {
  const key = Buffer.from(secret, 'base64');
  const hmac = createHmac('sha256', key).update(`v1:${timestamp}:${rawBody}`).digest('hex');
  return `v1=${hmac}`;
}

describe('samsaraAdapter.verifyWebhook', () => {
  const secret = Buffer.from('supersecretkey12345').toString('base64');
  const body = '{"eventType":"VehicleLocationUpdate","data":{}}';
  const freshTimestamp = () => Math.floor(Date.now() / 1000).toString();

  it('accepts a correctly signed payload', () => {
    const ts = freshTimestamp();
    const sig = samsaraSig(body, secret, ts);
    const ok = samsaraAdapter.verifyWebhook?.(
      { 'x-samsara-signature': sig, 'x-samsara-timestamp': ts },
      body,
      secret,
    );
    expect(ok).toBe(true);
  });

  it('rejects a tampered body', () => {
    const ts = freshTimestamp();
    const sig = samsaraSig(body, secret, ts);
    const ok = samsaraAdapter.verifyWebhook?.(
      { 'x-samsara-signature': sig, 'x-samsara-timestamp': ts },
      body + ' ',
      secret,
    );
    expect(ok).toBe(false);
  });

  it('rejects a wrong secret', () => {
    const ts = freshTimestamp();
    const sig = samsaraSig(body, secret, ts);
    const wrong = Buffer.from('nottherealsecret').toString('base64');
    const ok = samsaraAdapter.verifyWebhook?.(
      { 'x-samsara-signature': sig, 'x-samsara-timestamp': ts },
      body,
      wrong,
    );
    expect(ok).toBe(false);
  });

  it('rejects missing v1 prefix', () => {
    const ts = freshTimestamp();
    const key = Buffer.from(secret, 'base64');
    const hmac = createHmac('sha256', key).update(`v1:${ts}:${body}`).digest('hex');
    const ok = samsaraAdapter.verifyWebhook?.(
      { 'x-samsara-signature': hmac, 'x-samsara-timestamp': ts },
      body,
      secret,
    );
    expect(ok).toBe(false);
  });

  it('rejects missing headers', () => {
    expect(samsaraAdapter.verifyWebhook?.({}, body, secret)).toBe(false);
  });

  it('rejects a stale timestamp (replay defence)', () => {
    // 10 minutes old — outside the 5-minute window.
    const staleTs = (Math.floor(Date.now() / 1000) - 10 * 60).toString();
    const sig = samsaraSig(body, secret, staleTs);
    const ok = samsaraAdapter.verifyWebhook?.(
      { 'x-samsara-signature': sig, 'x-samsara-timestamp': staleTs },
      body,
      secret,
    );
    expect(ok).toBe(false);
  });

  it('rejects a future-dated timestamp beyond skew window', () => {
    const futureTs = (Math.floor(Date.now() / 1000) + 10 * 60).toString();
    const sig = samsaraSig(body, secret, futureTs);
    const ok = samsaraAdapter.verifyWebhook?.(
      { 'x-samsara-signature': sig, 'x-samsara-timestamp': futureTs },
      body,
      secret,
    );
    expect(ok).toBe(false);
  });

  it('rejects a non-numeric timestamp', () => {
    const ts = 'not-a-number';
    const sig = samsaraSig(body, secret, ts);
    const ok = samsaraAdapter.verifyWebhook?.(
      { 'x-samsara-signature': sig, 'x-samsara-timestamp': ts },
      body,
      secret,
    );
    expect(ok).toBe(false);
  });
});

describe('samsaraAdapter.parseWebhook', () => {
  it('emits a normalized position for VehicleLocationUpdate', () => {
    const payload = {
      eventType: 'VehicleLocationUpdate',
      data: {
        vehicle: { id: 'veh_abc' },
        location: { latitude: 37.7749, longitude: -122.4194, speed: 35, heading: 180, time: '2026-04-22T12:00:00Z' },
      },
    };
    const events = samsaraAdapter.parseWebhook?.(JSON.stringify(payload)) ?? [];
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      kind: 'position',
      position: {
        externalVehicleId: 'veh_abc',
        lat: 37.7749,
        lng: -122.4194,
        speed: 35,
        heading: 180,
      },
    });
  });

  it('ignores events without required fields', () => {
    const payload = { eventType: 'VehicleLocationUpdate', data: { vehicle: {} } };
    expect(samsaraAdapter.parseWebhook?.(JSON.stringify(payload)) ?? []).toHaveLength(0);
  });

  it('ignores other event types', () => {
    const payload = { eventType: 'SomethingElse', data: { vehicle: { id: 'v1' }, location: { latitude: 1, longitude: 2 } } };
    expect(samsaraAdapter.parseWebhook?.(JSON.stringify(payload)) ?? []).toHaveLength(0);
  });

  it('handles malformed JSON gracefully', () => {
    expect(samsaraAdapter.parseWebhook?.('{not json') ?? []).toHaveLength(0);
  });
});

describe('samsaraAdapter.startAuth', () => {
  it('returns an OAuth authorize URL with required params', async () => {
    const result = await samsaraAdapter.startAuth({ tenantId: 't1', redirectUri: 'https://homer.test/cb', state: 'abc123' });
    expect(result.kind).toBe('oauth');
    if (result.kind !== 'oauth') return;
    const url = new URL(result.redirectUrl);
    expect(url.origin + url.pathname).toBe('https://api.samsara.com/oauth2/authorize');
    expect(url.searchParams.get('client_id')).toBe('test-client');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('state')).toBe('abc123');
    expect(url.searchParams.get('redirect_uri')).toBe('https://homer.test/cb');
  });
});

describe('samsaraAdapter.completeAuth + refreshAuth', () => {
  const tokenResponse = {
    access_token: 'at',
    refresh_token: 'rt',
    expires_in: 3600,
    token_type: 'bearer',
    scope: 'admin:read',
  };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (urlStr.includes('/oauth2/token')) {
        const auth = (init?.headers as Record<string, string> | undefined)?.Authorization ?? '';
        if (!auth.startsWith('Basic ')) {
          return new Response('missing basic auth', { status: 401 });
        }
        return new Response(JSON.stringify(tokenResponse), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (urlStr.endsWith('/me')) {
        return new Response(JSON.stringify({ data: { organizationName: 'Acme Movers', organizationId: 'org_1' } }), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('{}', { status: 200 });
    }));
  });

  it('exchanges a code and captures account metadata', async () => {
    const result = await samsaraAdapter.completeAuth(
      { tenantId: 't1', redirectUri: 'https://homer.test/cb', state: 's' },
      { code: 'abc', redirectUri: 'https://homer.test/cb' },
    );
    expect(result.accountName).toBe('Acme Movers');
    expect(result.externalOrgId).toBe('org_1');
    expect((result.authMaterial as { accessToken: string }).accessToken).toBe('at');
  });

  it('refreshes using refresh_token grant', async () => {
    const newAuth = await samsaraAdapter.refreshAuth({ accessToken: 'old', refreshToken: 'rt', expiresAt: 0 });
    expect(newAuth).not.toBeNull();
    expect((newAuth as { refreshToken: string }).refreshToken).toBe('rt');
  });
});
