import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Job } from 'bullmq';

// Shared mutable state for the mocks below. vi.hoisted() makes it available to
// the hoisted vi.mock() factories (which run before the normal imports).
const h = vi.hoisted(() => ({
  // Args of every webhookQueue.add(...) call — the re-enqueue under test.
  addCalls: [] as unknown[][],
  // Values passed to every db.update().set(...) call.
  updates: [] as Array<{ values: Record<string, unknown> }>,
  // Rows returned by successive db.select()...limit() chains, in order:
  // first the delivery row, then the endpoint row.
  selectRows: [] as unknown[][],
}));

// Stub BullMQ so importing the worker module doesn't open a real Redis
// connection, and so we can observe the delayed re-enqueue.
vi.mock('bullmq', () => ({
  Queue: vi.fn(() => ({
    add: (...args: unknown[]) => {
      h.addCalls.push(args);
      return Promise.resolve();
    },
  })),
  Worker: vi.fn(),
}));

// Stub the DB layer: a thin chainable that returns queued rows for selects and
// records the values for updates.
vi.mock('../lib/db.js', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(h.selectRows.shift() ?? []),
        }),
      }),
    }),
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: () => {
          h.updates.push({ values });
          return Promise.resolve();
        },
      }),
    }),
  },
}));

// Silence the structured logger during tests.
vi.mock('../lib/logger.js', () => ({
  logger: { child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }) },
}));

import { processWebhookDelivery, nextRetryDelayMs, WEBHOOK_MAX_ATTEMPTS } from './webhook-delivery.js';

const baseDelivery = (over: Record<string, unknown> = {}) => ({
  id: 'd1',
  tenantId: 't1',
  endpointId: 'e1',
  event: 'order.delivered',
  payload: { hello: 'world' },
  attempts: 0,
  ...over,
});

const baseEndpoint = (over: Record<string, unknown> = {}) => ({
  id: 'e1',
  tenantId: 't1',
  url: 'https://example.com/webhook',
  secret: 'shhh',
  ...over,
});

const job = { data: { deliveryId: 'd1', endpointId: 'e1', tenantId: 't1' } } as Job;

// Find the webhookDeliveries update (the one carrying `status`), as opposed to
// the webhookEndpoints failure-tracking update.
const deliveryUpdate = () => h.updates.find((u) => 'status' in u.values)?.values;

beforeEach(() => {
  h.addCalls.length = 0;
  h.updates.length = 0;
  h.selectRows.length = 0;
});

describe('nextRetryDelayMs — retry backoff ladder', () => {
  it('exposes a 5-attempt cap (1 initial + 4 retries)', () => {
    expect(WEBHOOK_MAX_ATTEMPTS).toBe(5);
  });

  it('maps each failed attempt to its 30s → 2m → 15m → 1h delay', () => {
    expect(nextRetryDelayMs(1)).toBe(30_000);
    expect(nextRetryDelayMs(2)).toBe(120_000);
    expect(nextRetryDelayMs(3)).toBe(900_000);
    expect(nextRetryDelayMs(4)).toBe(3_600_000);
  });

  it('returns null once the cap is reached (give up, do not retry)', () => {
    expect(nextRetryDelayMs(WEBHOOK_MAX_ATTEMPTS)).toBeNull();
    expect(nextRetryDelayMs(WEBHOOK_MAX_ATTEMPTS + 1)).toBeNull();
    expect(nextRetryDelayMs(99)).toBeNull();
  });

  it('produces a strictly increasing delay for every reachable attempt', () => {
    const reachable = [1, 2, 3, 4].map((a) => nextRetryDelayMs(a) as number);
    for (let i = 1; i < reachable.length; i++) {
      expect(reachable[i]).toBeGreaterThan(reachable[i - 1]);
    }
  });
});

describe('processWebhookDelivery — failure handling', () => {
  it('re-enqueues a delayed retry instead of throwing on a transient failure', async () => {
    // Regression guard: the API enqueues with attempts:1, so the old "throw to
    // let BullMQ retry" path dead-lettered the job and the retry ladder never ran.
    h.selectRows.push([baseDelivery({ attempts: 0 })], [baseEndpoint()]);
    global.fetch = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 503, text: () => Promise.resolve('upstream down') });

    await expect(processWebhookDelivery(job)).resolves.toBeUndefined();

    expect(h.addCalls).toHaveLength(1);
    const [name, data, opts] = h.addCalls[0];
    expect(name).toBe('deliver');
    expect(data).toEqual({ deliveryId: 'd1', endpointId: 'e1', tenantId: 't1' });
    expect(opts).toEqual({ delay: 30_000 });

    const upd = deliveryUpdate();
    expect(upd?.status).toBe('pending');
    expect(upd?.attempts).toBe(1);
    expect(upd?.nextRetryAt).toBeInstanceOf(Date);
  });

  it('uses the 2m delay for the second failed attempt', async () => {
    h.selectRows.push([baseDelivery({ attempts: 1 })], [baseEndpoint()]);
    global.fetch = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 500, text: () => Promise.resolve('boom') });

    await processWebhookDelivery(job);

    expect(h.addCalls).toHaveLength(1);
    expect(h.addCalls[0][2]).toEqual({ delay: 120_000 });
    expect(deliveryUpdate()?.attempts).toBe(2);
  });

  it('marks the delivery failed and does NOT re-enqueue once the ladder is exhausted', async () => {
    // attempts:4 → this is the 5th (final) attempt.
    h.selectRows.push([baseDelivery({ attempts: 4 })], [baseEndpoint()]);
    global.fetch = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 500, text: () => Promise.resolve('still down') });

    await processWebhookDelivery(job);

    expect(h.addCalls).toHaveLength(0);
    const upd = deliveryUpdate();
    expect(upd?.status).toBe('failed');
    expect(upd?.attempts).toBe(5);
    expect(upd?.nextRetryAt).toBeNull();
  });
});

describe('processWebhookDelivery — success and SSRF guard', () => {
  it('marks success and does not re-enqueue when the endpoint returns 2xx', async () => {
    h.selectRows.push([baseDelivery({ attempts: 0 })], [baseEndpoint()]);
    global.fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200, text: () => Promise.resolve('') });

    await processWebhookDelivery(job);

    expect(global.fetch).toHaveBeenCalledOnce();
    expect(h.addCalls).toHaveLength(0);
    expect(deliveryUpdate()?.status).toBe('success');
  });

  it('blocks an SSRF-target URL before any HTTP request and never retries it', async () => {
    // 169.254.169.254 is the cloud metadata endpoint — a classic SSRF target.
    h.selectRows.push(
      [baseDelivery({ attempts: 0 })],
      [baseEndpoint({ url: 'https://169.254.169.254/latest/meta-data' })],
    );
    global.fetch = vi.fn();

    await processWebhookDelivery(job);

    expect(global.fetch).not.toHaveBeenCalled();
    expect(h.addCalls).toHaveLength(0);
    const upd = deliveryUpdate();
    expect(upd?.status).toBe('failed');
    // Marked terminal (ladder exhausted) so it is never retried.
    expect(upd?.attempts).toBe(WEBHOOK_MAX_ATTEMPTS);
  });
});
