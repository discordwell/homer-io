/**
 * Stripe webhook deduplication — atomic SET NX semantics.
 *
 * Covers the HIGH-severity billing-correctness finding:
 *   The prior check-then-set (cacheGet → cacheSet) was non-atomic, so two
 *   concurrent retries of the same event.id could both pass the dedup check
 *   and both fully process (double-booking subs, double-crediting invoices).
 *
 * The fix uses Redis `SET key value EX ttl NX` — atomic set-if-not-exists —
 * plus "claim-before-process + cleanup-on-error" so Stripe can still retry
 * when processing throws transiently.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';

// --- In-memory Redis mock shared across the cache module ---

type RedisEntry = { value: string; expiresAt: number | null };

class MockRedis {
  store = new Map<string, RedisEntry>();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(
    key: string,
    value: string,
    ..._args: unknown[]
  ): Promise<string | null> {
    // Parse variadic options: supports 'EX', ttl, 'NX'.
    const args = _args.map((a) => (typeof a === 'string' ? a.toUpperCase() : a));
    const exIdx = args.indexOf('EX');
    const nx = args.includes('NX');
    const ttlSeconds = exIdx >= 0 ? Number(args[exIdx + 1]) : null;

    if (nx) {
      const existing = this.store.get(key);
      if (existing && (existing.expiresAt === null || existing.expiresAt >= Date.now())) {
        return null; // NX fails: key exists
      }
    }

    this.store.set(key, {
      value,
      expiresAt: ttlSeconds !== null ? Date.now() + ttlSeconds * 1000 : null,
    });
    return 'OK';
  }

  async del(key: string): Promise<number> {
    return this.store.delete(key) ? 1 : 0;
  }
}

const mockRedisInstance = new MockRedis();

vi.mock('ioredis', () => {
  return {
    default: class {
      constructor() {
        return mockRedisInstance;
      }
    },
  };
});

vi.mock('../config.js', () => ({
  config: {
    redis: { url: 'redis://localhost:6379' },
    stripe: {
      secretKey: 'sk_test_fake',
      webhookSecret: 'whsec_test_fake',
      prices: {},
    },
  },
}));

// --- Stripe mock: constructEvent returns the JSON body verbatim ---
vi.mock('stripe', () => {
  return {
    default: class {
      webhooks = {
        constructEvent: (body: Buffer | string) => {
          const raw = typeof body === 'string' ? body : body.toString('utf8');
          return JSON.parse(raw);
        },
      };
    },
  };
});

// --- billing service mock: we count invocations to verify exactly-once ---
const handleWebhookEventMock = vi.fn();
vi.mock('../modules/billing/service.js', () => ({
  handleWebhookEvent: (...args: unknown[]) => handleWebhookEventMock(...args),
}));

// ---------------------------------------------------------------------------

describe('cacheSetNX — atomic set-if-not-exists', () => {
  beforeEach(() => {
    mockRedisInstance.store.clear();
  });

  it('returns true when the key is newly set', async () => {
    const { cacheSetNX } = await import('../lib/cache.js');
    const result = await cacheSetNX('nx:fresh', '1', 60);
    expect(result).toBe(true);
  });

  it('returns false when the key already exists', async () => {
    const { cacheSetNX } = await import('../lib/cache.js');
    const first = await cacheSetNX('nx:taken', '1', 60);
    const second = await cacheSetNX('nx:taken', '1', 60);
    expect(first).toBe(true);
    expect(second).toBe(false);
  });

  it('concurrent calls on the same key → exactly one winner', async () => {
    const { cacheSetNX } = await import('../lib/cache.js');
    const results = await Promise.all(
      Array.from({ length: 10 }, () => cacheSetNX('nx:race', '1', 60)),
    );
    const winners = results.filter((r) => r === true);
    const losers = results.filter((r) => r === false);
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(9);
  });

  it('different keys do not collide', async () => {
    const { cacheSetNX } = await import('../lib/cache.js');
    const a = await cacheSetNX('nx:a', '1', 60);
    const b = await cacheSetNX('nx:b', '1', 60);
    expect(a).toBe(true);
    expect(b).toBe(true);
  });

  it('after cacheDelete, the key can be claimed again (retry path)', async () => {
    const { cacheSetNX, cacheDelete } = await import('../lib/cache.js');
    expect(await cacheSetNX('nx:retry', '1', 60)).toBe(true);
    expect(await cacheSetNX('nx:retry', '1', 60)).toBe(false);
    await cacheDelete('nx:retry');
    expect(await cacheSetNX('nx:retry', '1', 60)).toBe(true);
  });
});

// ---------------------------------------------------------------------------

describe('Stripe webhook — dedup integration', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    mockRedisInstance.store.clear();
    handleWebhookEventMock.mockReset();
    handleWebhookEventMock.mockResolvedValue(undefined);

    const { billingWebhookPlugin } = await import('../modules/billing/webhook.js');
    app = Fastify();
    await app.register(billingWebhookPlugin);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  function postEvent(eventId: string, type = 'customer.subscription.updated') {
    const body = JSON.stringify({ id: eventId, type, data: { object: {} } });
    return app.inject({
      method: 'POST',
      url: '/stripe/webhook',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': 'fake-sig',
      },
      payload: body,
    });
  }

  it('processes a new event exactly once', async () => {
    const res = await postEvent('evt_unique_1');
    expect(res.statusCode).toBe(200);
    expect(handleWebhookEventMock).toHaveBeenCalledTimes(1);
  });

  it('duplicate delivery of the same event.id is skipped', async () => {
    await postEvent('evt_dup_1');
    await postEvent('evt_dup_1');
    await postEvent('evt_dup_1');
    expect(handleWebhookEventMock).toHaveBeenCalledTimes(1);
  });

  it('concurrent deliveries of the same event.id → exactly one processes', async () => {
    // Make the handler slow so both requests overlap the dedup window.
    let resolveHandler: () => void = () => {};
    const handlerGate = new Promise<void>((r) => {
      resolveHandler = r;
    });
    handleWebhookEventMock.mockImplementation(async () => {
      await handlerGate;
    });

    const [p1, p2, p3] = [postEvent('evt_race_1'), postEvent('evt_race_1'), postEvent('evt_race_1')];
    // Yield so all three requests claim the key before we release the handler.
    await new Promise((r) => setImmediate(r));
    resolveHandler();
    const responses = await Promise.all([p1, p2, p3]);

    for (const res of responses) {
      expect(res.statusCode).toBe(200);
    }
    // The race-winner processes once; losers short-circuit on the NX claim.
    expect(handleWebhookEventMock).toHaveBeenCalledTimes(1);
  });

  it('different event.ids each process independently', async () => {
    await postEvent('evt_a');
    await postEvent('evt_b');
    await postEvent('evt_c');
    expect(handleWebhookEventMock).toHaveBeenCalledTimes(3);
  });

  it('when processing throws, dedup key is released and retry succeeds', async () => {
    // First call throws → should 5xx and release the claim.
    handleWebhookEventMock.mockRejectedValueOnce(new Error('transient failure'));
    const first = await postEvent('evt_retry_1');
    expect(first.statusCode).toBe(500);

    // Key must be gone so Stripe's retry can reclaim and reprocess.
    expect(mockRedisInstance.store.has('homer:stripe:event:evt_retry_1')).toBe(false);

    // Retry succeeds → handler invoked a second time.
    handleWebhookEventMock.mockResolvedValueOnce(undefined);
    const retry = await postEvent('evt_retry_1');
    expect(retry.statusCode).toBe(200);
    expect(handleWebhookEventMock).toHaveBeenCalledTimes(2);
  });

  it('after successful processing, the dedup key is retained (blocks further replays)', async () => {
    await postEvent('evt_retained_1');
    expect(mockRedisInstance.store.has('homer:stripe:event:evt_retained_1')).toBe(true);
  });

  it('rejects request with missing stripe-signature header', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/stripe/webhook',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ id: 'evt_no_sig', type: 'x' }),
    });
    expect(res.statusCode).toBe(400);
    expect(handleWebhookEventMock).not.toHaveBeenCalled();
  });
});
