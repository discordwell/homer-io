import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock infrastructure that models a real Postgres-ish row-locking semantic
// for two concrete resources the billing race-fix cares about:
//   1. metered_usage rows (keyed by tenantId + period)         — FOR UPDATE
//   2. tenant advisory xact locks (pg_advisory_xact_lock)       — per-tenant
// ---------------------------------------------------------------------------

type MeteredRow = {
  tenantId: string;
  period: string;
  aiChatMessages: number;
  aiOptimizations: number;
  aiDispatches: number;
  smsSent: number;
  emailsSent: number;
  podStorageMb: number;
};

// Committed state — only visible to a tx after its own uncommitted changes are
// merged on top. Updated at commit time.
const committedMetered: Map<string, MeteredRow> = new Map();
const committedOrders: Array<{ id: string; tenantId: string; createdAt: Date }> = [];

// Per-resource locks. A promise that resolves when the current holder releases.
const meteredLocks: Map<string, Promise<void>> = new Map();
const advisoryLocks: Map<string, Promise<void>> = new Map();

let txCounter = 0;
let payAsYouGoEnabled = false;
let subscriptionPlan: 'free' | 'standard' | 'growth' | 'scale' | 'enterprise' = 'free';

function resetState() {
  committedMetered.clear();
  committedOrders.length = 0;
  meteredLocks.clear();
  advisoryLocks.clear();
  txCounter = 0;
  payAsYouGoEnabled = false;
  subscriptionPlan = 'free';
}

// Proper per-key mutex: each waiter chains onto a single promise, so N waiters
// wake up serialized (not all at once). This models pg row/advisory locks.
async function acquireLock(map: Map<string, Promise<void>>, key: string): Promise<() => void> {
  const prev = map.get(key) ?? Promise.resolve();
  let release!: () => void;
  const mine = new Promise<void>((resolve) => { release = resolve; });
  const chained = prev.then(() => mine);
  map.set(key, chained);
  await prev; // wait for the previous holder to release
  return () => {
    // If we're still the tail, drop the chain so it GCs cleanly.
    if (map.get(key) === chained) map.delete(key);
    release();
  };
}

function meteredKey(tenantId: string, period: string) {
  return `${tenantId}|${period}`;
}

function cloneRow(row: MeteredRow): MeteredRow {
  return { ...row };
}

// Build a transaction handle that supports just the operations our fixes use.
// Each tx buffers writes in a local map, acquires locks on access, and applies
// its buffer to committedState atomically at commit time.
function makeTransaction() {
  const txId = ++txCounter;
  const localMetered: Map<string, MeteredRow> = new Map();
  const releases: Array<() => void> = [];

  async function readMeteredLocked(tenantId: string, period: string): Promise<MeteredRow | undefined> {
    const key = meteredKey(tenantId, period);
    // SELECT ... FOR UPDATE: take the row lock. Any prior tx holding the lock
    // has committed/rolled back by the time this resolves. Snapshot the
    // current committed value (our view AFTER the lock is fresh).
    const release = await acquireLock(meteredLocks, key);
    releases.push(release);
    const committed = committedMetered.get(key);
    if (committed) {
      const snap = cloneRow(committed);
      localMetered.set(key, snap); // seed local from committed for subsequent writes
      return cloneRow(snap);
    }
    // No committed row (even after onConflictDoNothing). Return undefined; the
    // caller treats existingValue = 0.
    return undefined;
  }

  async function insertMeteredOnConflictDoNothing(tenantId: string, period: string) {
    // In real pg, INSERT ... ON CONFLICT DO NOTHING either inserts a fresh row
    // (committed immediately on tx commit) or does nothing. For our mock we
    // commit it to the shared table right away, gated by the row lock, so
    // subsequent FOR UPDATE selects see it. This keeps the semantic tight.
    const key = meteredKey(tenantId, period);
    if (committedMetered.has(key)) return; // conflict → noop
    const release = await acquireLock(meteredLocks, key);
    try {
      if (committedMetered.has(key)) return; // double-check
      committedMetered.set(key, {
        tenantId, period,
        aiChatMessages: 0, aiOptimizations: 0, aiDispatches: 0,
        smsSent: 0, emailsSent: 0, podStorageMb: 0,
      });
    } finally {
      release();
    }
  }

  async function updateMetered(tenantId: string, period: string, feature: keyof MeteredRow, delta: number): Promise<MeteredRow> {
    const key = meteredKey(tenantId, period);
    const base =
      localMetered.get(key) ??
      (committedMetered.get(key) ? cloneRow(committedMetered.get(key)!) : undefined);
    if (!base) throw new Error('update missed row');
    (base as any)[feature] = (base as any)[feature] + delta;
    localMetered.set(key, base);
    return cloneRow(base);
  }

  async function countMonthOrders(tenantId: string, monthStart: Date): Promise<number> {
    return committedOrders.filter((o) => o.tenantId === tenantId && o.createdAt >= monthStart).length;
  }

  async function insertOrder(tenantId: string) {
    committedOrders.push({
      id: `order-${txId}-${committedOrders.length}`,
      tenantId,
      createdAt: new Date(),
    });
  }

  async function acquireAdvisory(tenantId: string) {
    const release = await acquireLock(advisoryLocks, tenantId);
    releases.push(release);
  }

  async function commit() {
    for (const [key, row] of localMetered) {
      committedMetered.set(key, row);
    }
    for (const r of releases) r();
  }
  async function rollback() {
    for (const r of releases) r();
  }

  return {
    readMeteredLocked,
    insertMeteredOnConflictDoNothing,
    updateMetered,
    countMonthOrders,
    insertOrder,
    acquireAdvisory,
    commit,
    rollback,
  };
}

// Helper — simulate `db.transaction(cb)` for the billing tests.
async function simulateRecordMeteredUsage(
  tenantId: string,
  feature: keyof MeteredRow,
  amount: number,
  quota: number,
): Promise<{ allowed: boolean; newTotal: number; reason?: string }> {
  const tx = makeTransaction();
  try {
    // step 1: INSERT ... ON CONFLICT DO NOTHING
    await tx.insertMeteredOnConflictDoNothing(tenantId, '2026-04');
    // step 2: SELECT ... FOR UPDATE (locks row)
    const current = await tx.readMeteredLocked(tenantId, '2026-04');
    const existing = current ? (current as any)[feature] as number : 0;
    const prospective = existing + amount;
    // step 3: consult payAsYouGo
    const overQuota = prospective > quota;
    if (overQuota && !payAsYouGoEnabled) {
      await tx.commit();
      return {
        allowed: false,
        newTotal: existing,
        reason: `Monthly ${feature} quota exceeded (${existing}/${quota}). Enable Pay-as-you-go in Settings > Billing to continue.`,
      };
    }
    // step 5: atomic increment on locked row
    const updated = await tx.updateMetered(tenantId, '2026-04', feature, amount);
    await tx.commit();
    return { allowed: true, newTotal: (updated as any)[feature] as number };
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

async function simulateCreateOrder(
  tenantId: string,
  limit: number,
): Promise<{ ok: true } | { ok: false; reason: 'limit' }> {
  const tx = makeTransaction();
  try {
    // advisory lock first — serializes per-tenant order creates
    await tx.acquireAdvisory(tenantId);
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const count = await tx.countMonthOrders(tenantId, monthStart);
    if (count + 1 > limit) {
      await tx.rollback();
      return { ok: false, reason: 'limit' };
    }
    await tx.insertOrder(tenantId);
    await tx.commit();
    return { ok: true };
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

describe('Billing race-fix — recordMeteredUsage (locked increment)', () => {
  beforeEach(() => resetState());

  it('serializes two concurrent callers at the quota boundary (no overshoot)', async () => {
    const tenantId = 'tenant-1';
    const quota = 10;
    // seed: 9 used, 1 remaining
    committedMetered.set(meteredKey(tenantId, '2026-04'), {
      tenantId, period: '2026-04',
      aiChatMessages: 9, aiOptimizations: 0, aiDispatches: 0,
      smsSent: 0, emailsSent: 0, podStorageMb: 0,
    });

    const [r1, r2] = await Promise.all([
      simulateRecordMeteredUsage(tenantId, 'aiChatMessages', 1, quota),
      simulateRecordMeteredUsage(tenantId, 'aiChatMessages', 1, quota),
    ]);

    const allowed = [r1, r2].filter((r) => r.allowed).length;
    const denied = [r1, r2].filter((r) => !r.allowed).length;
    expect(allowed).toBe(1);
    expect(denied).toBe(1);

    // Committed total is exactly the quota — not over.
    const final = committedMetered.get(meteredKey(tenantId, '2026-04'))!;
    expect(final.aiChatMessages).toBe(10);
    expect(final.aiChatMessages).toBeLessThanOrEqual(quota);
  });

  it('denies without incrementing when over quota (payAsYouGo off)', async () => {
    const tenantId = 'tenant-1';
    const quota = 10;
    committedMetered.set(meteredKey(tenantId, '2026-04'), {
      tenantId, period: '2026-04',
      aiChatMessages: 10, aiOptimizations: 0, aiDispatches: 0,
      smsSent: 0, emailsSent: 0, podStorageMb: 0,
    });

    const r = await simulateRecordMeteredUsage(tenantId, 'aiChatMessages', 1, quota);

    expect(r.allowed).toBe(false);
    expect(r.reason).toContain('quota exceeded');
    // Usage is unchanged — we did NOT bill the rejected request.
    const final = committedMetered.get(meteredKey(tenantId, '2026-04'))!;
    expect(final.aiChatMessages).toBe(10);
  });

  it('allows overage when payAsYouGo is enabled', async () => {
    const tenantId = 'tenant-1';
    const quota = 10;
    payAsYouGoEnabled = true;
    committedMetered.set(meteredKey(tenantId, '2026-04'), {
      tenantId, period: '2026-04',
      aiChatMessages: 10, aiOptimizations: 0, aiDispatches: 0,
      smsSent: 0, emailsSent: 0, podStorageMb: 0,
    });

    const r = await simulateRecordMeteredUsage(tenantId, 'aiChatMessages', 1, quota);

    expect(r.allowed).toBe(true);
    expect(r.newTotal).toBe(11);
  });

  it('heavy concurrency (20 callers) never overshoots the quota', async () => {
    const tenantId = 'tenant-1';
    const quota = 5;

    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        simulateRecordMeteredUsage(tenantId, 'aiChatMessages', 1, quota),
      ),
    );

    const allowed = results.filter((r) => r.allowed).length;
    expect(allowed).toBe(quota);

    const final = committedMetered.get(meteredKey(tenantId, '2026-04'))!;
    expect(final.aiChatMessages).toBe(quota);
  });

  it('returns newTotal so callers can use post-increment value instead of pre-read', async () => {
    const tenantId = 'tenant-1';
    const quota = 10;
    committedMetered.set(meteredKey(tenantId, '2026-04'), {
      tenantId, period: '2026-04',
      aiChatMessages: 3, aiOptimizations: 0, aiDispatches: 0,
      smsSent: 0, emailsSent: 0, podStorageMb: 0,
    });

    const r = await simulateRecordMeteredUsage(tenantId, 'aiChatMessages', 2, quota);

    expect(r.allowed).toBe(true);
    expect(r.newTotal).toBe(5);
  });

  it('different tenants do not contend on the same row lock', async () => {
    const quota = 10;
    // Both tenants start at 9/10
    committedMetered.set(meteredKey('tenant-A', '2026-04'), {
      tenantId: 'tenant-A', period: '2026-04',
      aiChatMessages: 9, aiOptimizations: 0, aiDispatches: 0,
      smsSent: 0, emailsSent: 0, podStorageMb: 0,
    });
    committedMetered.set(meteredKey('tenant-B', '2026-04'), {
      tenantId: 'tenant-B', period: '2026-04',
      aiChatMessages: 9, aiOptimizations: 0, aiDispatches: 0,
      smsSent: 0, emailsSent: 0, podStorageMb: 0,
    });

    const [a, b] = await Promise.all([
      simulateRecordMeteredUsage('tenant-A', 'aiChatMessages', 1, quota),
      simulateRecordMeteredUsage('tenant-B', 'aiChatMessages', 1, quota),
    ]);

    expect(a.allowed).toBe(true);
    expect(b.allowed).toBe(true);
  });
});

describe('Billing race-fix — order-limit (advisory lock + count inside tx)', () => {
  beforeEach(() => resetState());

  it('two concurrent order creates at limit-1 never overshoot (serialized)', async () => {
    const tenantId = 'tenant-1';
    const limit = 10;
    // seed: 9 orders already this month
    for (let i = 0; i < 9; i++) {
      committedOrders.push({ id: `seed-${i}`, tenantId, createdAt: new Date() });
    }

    const [r1, r2] = await Promise.all([
      simulateCreateOrder(tenantId, limit),
      simulateCreateOrder(tenantId, limit),
    ]);

    const ok = [r1, r2].filter((r) => r.ok).length;
    const rejected = [r1, r2].filter((r) => !r.ok).length;
    expect(ok).toBe(1);
    expect(rejected).toBe(1);
    expect(committedOrders.length).toBe(10);
  });

  it('batch import + single create cannot collectively overshoot', async () => {
    const tenantId = 'tenant-1';
    const limit = 10;
    // seed: 8 already this month — 2 remaining
    for (let i = 0; i < 8; i++) {
      committedOrders.push({ id: `seed-${i}`, tenantId, createdAt: new Date() });
    }

    // One caller tries to create a single order; the other tries to bulk-import 3.
    // The advisory lock ensures the second check sees the first's writes.
    async function simulateImport(n: number) {
      const tx = makeTransaction();
      try {
        await tx.acquireAdvisory(tenantId);
        const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const count = await tx.countMonthOrders(tenantId, monthStart);
        if (count + n > limit) {
          await tx.rollback();
          return { ok: false as const };
        }
        for (let i = 0; i < n; i++) await tx.insertOrder(tenantId);
        await tx.commit();
        return { ok: true as const };
      } catch (err) {
        await tx.rollback();
        throw err;
      }
    }

    const [single, bulk] = await Promise.all([
      simulateCreateOrder(tenantId, limit),
      simulateImport(3),
    ]);

    // At most one succeeds because 8+1+3 = 12 > 10 and 8+3 = 11 > 10 as well;
    // whichever went first allows the other to decide correctly.
    // Specifically: if single went first -> orders=9, import sees 9+3>10 -> rejects.
    //              if import went first  -> orders=11>10 -> import itself rejects, then single sees 8 orders, inserts -> orders=9.
    // In either ordering we should never end up above the limit.
    expect(committedOrders.length).toBeLessThanOrEqual(limit);
    expect(single.ok || bulk.ok).toBe(true); // at least one succeeded
  });

  it('different tenants do not contend on the advisory lock', async () => {
    const limit = 5;
    // Both tenants at 4/5 — each should successfully add one more.
    for (let i = 0; i < 4; i++) {
      committedOrders.push({ id: `A-${i}`, tenantId: 'tenant-A', createdAt: new Date() });
      committedOrders.push({ id: `B-${i}`, tenantId: 'tenant-B', createdAt: new Date() });
    }

    const [a, b] = await Promise.all([
      simulateCreateOrder('tenant-A', limit),
      simulateCreateOrder('tenant-B', limit),
    ]);

    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Structural / contract tests against the actual service implementation —
// these assert (via module mocks) that recordMeteredUsage (a) runs inside a
// transaction and (b) takes a row lock before deciding whether to increment.
// Catches regressions of the fix to plain read-then-write.
// ---------------------------------------------------------------------------

// Mock schema modules
vi.mock('../lib/db/schema/metered-usage.js', () => ({
  meteredUsage: {
    id: 'id',
    tenantId: 'tenant_id',
    period: 'period',
    aiChatMessages: 'ai_chat_messages',
    aiOptimizations: 'ai_optimizations',
    aiDispatches: 'ai_dispatches',
    smsSent: 'sms_sent',
    emailsSent: 'emails_sent',
    podStorageMb: 'pod_storage_mb',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
}));
vi.mock('../lib/db/schema/subscriptions.js', () => ({
  subscriptions: {
    id: 'id', tenantId: 'tenant_id', plan: 'plan', status: 'status',
    payAsYouGoEnabled: 'pay_as_you_go_enabled', trialEndsAt: 'trial_ends_at',
    currentPeriodStart: 'current_period_start', currentPeriodEnd: 'current_period_end',
    canceledAt: 'canceled_at', stripeCustomerId: 'stripe_customer_id',
    stripeSubscriptionId: 'stripe_subscription_id', updatedAt: 'updated_at',
  },
}));
vi.mock('../lib/db/schema/usage-records.js', () => ({
  usageRecords: {
    id: 'id', tenantId: 'tenant_id', period: 'period',
    driverCount: 'driver_count', orderCount: 'order_count', routeCount: 'route_count',
  },
}));
vi.mock('../lib/db/schema/invoices.js', () => ({
  invoices: {
    id: 'id', tenantId: 'tenant_id', stripeInvoiceId: 'stripe_invoice_id',
    status: 'status', amountDue: 'amount_due', amountPaid: 'amount_paid',
    currency: 'currency', invoiceUrl: 'invoice_url', invoicePdf: 'invoice_pdf',
    periodStart: 'period_start', periodEnd: 'period_end', createdAt: 'created_at',
  },
}));
vi.mock('../lib/db/schema/orders.js', () => ({
  orders: {
    id: 'id', tenantId: 'tenant_id', createdAt: 'created_at',
  },
}));
vi.mock('../lib/activity.js', () => ({ logActivity: vi.fn() }));
vi.mock('../lib/cache.js', () => ({ cacheDelete: vi.fn(), cacheGet: vi.fn(), cacheSet: vi.fn() }));
vi.mock('../lib/errors.js', () => ({
  NotFoundError: class extends Error {
    constructor(m: string) { super(m); this.name = 'NotFoundError'; }
  },
}));
vi.mock('../config.js', () => ({ config: { stripe: { secretKey: '', prices: {} }, cors: { origin: [''] } } }));

// The DB mock records the *order* of operations so we can assert the expected
// flow:  insert(onConflictDoNothing) -> select FOR UPDATE -> select sub ->
//        (if allowed) update(increment) -> commit.
const opsLog: string[] = [];
let mockExistingValue = 0;
let mockPayAsYouGo = false;

function buildTxMock() {
  return {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockImplementation(() => {
          opsLog.push('insert.onConflictDoNothing');
          return Promise.resolve();
        }),
      }),
    }),
    select: vi.fn().mockImplementation((fields?: any) => {
      // distinguishing select() (metered row) vs select({...}) (subscription)
      const isSubscription = !!fields && 'payAsYouGoEnabled' in fields;
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            for: vi.fn().mockImplementation((strength: string) => {
              opsLog.push(`select.for.${strength}`);
              return {
                limit: vi.fn().mockResolvedValue([{ aiChatMessages: mockExistingValue }]),
              };
            }),
            limit: vi.fn().mockImplementation(() => {
              if (isSubscription) {
                opsLog.push('select.subscription');
                return Promise.resolve([{ payAsYouGoEnabled: mockPayAsYouGo }]);
              }
              return Promise.resolve([{ aiChatMessages: mockExistingValue }]);
            }),
          }),
        }),
      };
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockImplementation(() => {
            opsLog.push('update.increment');
            return Promise.resolve([{ aiChatMessages: mockExistingValue + 1 }]);
          }),
        }),
      }),
    }),
  };
}

const mockDb = {
  transaction: vi.fn().mockImplementation(async (cb: (tx: any) => Promise<any>) => {
    opsLog.push('tx.begin');
    const result = await cb(buildTxMock());
    opsLog.push('tx.commit');
    return result;
  }),
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
};
vi.mock('../lib/db/index.js', () => ({ db: mockDb }));

describe('Billing race-fix — recordMeteredUsage contract', () => {
  beforeEach(() => {
    opsLog.length = 0;
    mockExistingValue = 0;
    mockPayAsYouGo = false;
  });

  it('uses a transaction and acquires FOR UPDATE lock before deciding', async () => {
    const { recordMeteredUsage } = await import('../modules/billing/service.js');
    mockExistingValue = 2;
    const result = await recordMeteredUsage('tenant-1', 'aiChatMessages', 1);

    expect(result.allowed).toBe(true);
    // Order-of-operations assertion: the fix must (a) open tx, (b) row-lock,
    // (c) check, (d) update. If anyone reverts to read-then-write without
    // locking, this assertion fails.
    expect(opsLog[0]).toBe('tx.begin');
    const lockIdx = opsLog.findIndex((s) => s === 'select.for.update');
    const updateIdx = opsLog.findIndex((s) => s === 'update.increment');
    expect(lockIdx).toBeGreaterThan(-1);
    expect(updateIdx).toBeGreaterThan(lockIdx);
    expect(opsLog[opsLog.length - 1]).toBe('tx.commit');
  });

  it('does NOT perform an increment update when over quota and payAsYouGo is off', async () => {
    const { recordMeteredUsage, } = await import('../modules/billing/service.js');
    // Quota for aiChatMessages is 50; seed existing at 50, delta=1 -> 51 > 50.
    mockExistingValue = 50;
    mockPayAsYouGo = false;

    const result = await recordMeteredUsage('tenant-1', 'aiChatMessages', 1);

    expect(result.allowed).toBe(false);
    expect(result.newTotal).toBe(50); // unchanged
    // Crucially: no update.increment in the ops log.
    expect(opsLog.filter((s) => s === 'update.increment').length).toBe(0);
  });

  it('DOES perform an increment when over quota but payAsYouGo is enabled', async () => {
    const { recordMeteredUsage, } = await import('../modules/billing/service.js');
    mockExistingValue = 50;
    mockPayAsYouGo = true;

    const result = await recordMeteredUsage('tenant-1', 'aiChatMessages', 1);

    expect(result.allowed).toBe(true);
    expect(opsLog.filter((s) => s === 'update.increment').length).toBe(1);
  });

  it('returns newTotal alongside allowed/reason', async () => {
    const { recordMeteredUsage, } = await import('../modules/billing/service.js');
    mockExistingValue = 7;
    const result = await recordMeteredUsage('tenant-1', 'aiChatMessages', 1);
    expect(result).toHaveProperty('newTotal');
    expect(result.newTotal).toBe(8);
  });
});
