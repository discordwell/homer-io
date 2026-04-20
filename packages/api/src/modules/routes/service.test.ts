/**
 * Unit tests for routes/service.ts bulk UPDATE strategy (createRoute)
 * and a regression/injection surface check against the order-id input path.
 *
 * These tests mock the db + schema to assert two things:
 *   1) The bulk-assign path builds exactly ONE update per createRoute call
 *      (no per-order UPDATE), and the SQL CASE expression assigns
 *      stopSequence = input-array-index + 1 for each id.
 *   2) Order-id values pass through Drizzle's `sql` template as parameterized
 *      bindings (Param objects) — never as raw SQL strings — so a malicious
 *      string cannot alter the query shape.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Capture the SQL expressions the service constructs. ------------------

/** Whatever .set() is called with (for bulk assign assertions) */
let lastUpdateSet: any = null;
/** Count of tx.update() calls inside createRoute */
let updateCallCount = 0;

const mockReturningInsert = vi.fn().mockResolvedValue([{ id: 'route-1', tenantId: 'tenant-1', name: 'Route' }]);
const mockInsertValues = vi.fn().mockReturnValue({ returning: mockReturningInsert });
const mockInsert = vi.fn().mockReturnValue({ values: mockInsertValues });

// tx.select().from().where() must return order-row shapes for the pre-check path.
const txSelectFromWhere = vi.fn();

const mockTx: any = {
  insert: mockInsert,
  update: vi.fn().mockImplementation(() => {
    updateCallCount++;
    return {
      set: vi.fn().mockImplementation((values: any) => {
        lastUpdateSet = values;
        return { where: vi.fn().mockResolvedValue(undefined) };
      }),
    };
  }),
  select: vi.fn().mockImplementation(() => ({
    from: vi.fn().mockReturnValue({
      where: txSelectFromWhere,
    }),
  })),
};

// Outer db (non-tx) — returns empty lists for the post-transaction reads.
const dbSelectFromWhere = vi.fn().mockReturnValue({
  orderBy: vi.fn().mockResolvedValue([]),
  limit: vi.fn().mockResolvedValue([]),
});
const dbSelectFrom = vi.fn().mockReturnValue({ where: dbSelectFromWhere });
const mockDb = {
  transaction: vi.fn().mockImplementation(async (fn: any) => fn(mockTx)),
  select: vi.fn().mockReturnValue({ from: dbSelectFrom }),
};

vi.mock('../../lib/db/index.js', () => ({ db: mockDb }));

// Schema mocks — identity-string objects are fine because we never actually
// execute SQL against them; we only inspect the SQL chunks.
vi.mock('../../lib/db/schema/routes.js', () => ({
  routes: { id: 'id', tenantId: 'tenant_id', status: 'status', driverId: 'driver_id' },
  routeStatusEnum: { enumValues: ['draft', 'planned', 'in_progress', 'completed', 'cancelled'] },
}));
vi.mock('../../lib/db/schema/orders.js', () => ({
  orders: {
    id: 'id', tenantId: 'tenant_id', routeId: 'route_id',
    stopSequence: 'stop_sequence', status: 'status', updatedAt: 'updated_at',
    recipientName: 'recipient_name', timeWindowStart: 'time_window_start',
    timeWindowEnd: 'time_window_end',
  },
}));
vi.mock('../../lib/db/schema/drivers.js', () => ({ drivers: { id: 'id', status: 'status' } }));
vi.mock('../../lib/db/schema/notifications.js', () => ({ notifications: {} }));
vi.mock('../../lib/db/schema/users.js', () => ({ users: { id: 'id', tenantId: 'tenant_id', isActive: 'is_active', role: 'role' } }));
vi.mock('../../lib/db/schema/tenants.js', () => ({ tenants: { id: 'id', settings: 'settings' } }));
vi.mock('../../lib/errors.js', () => ({
  NotFoundError: class NotFoundError extends Error {
    constructor(msg: string) { super(msg); this.name = 'NotFoundError'; }
  },
  HttpError: class HttpError extends Error {
    statusCode: number;
    constructor(status: number, msg: string) { super(msg); this.statusCode = status; }
  },
}));
vi.mock('../../lib/ws/index.js', () => ({ broadcastToTenant: vi.fn() }));
vi.mock('../../lib/activity.js', () => ({ logActivity: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../lib/webhooks.js', () => ({ enqueueWebhook: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../customer-notifications/service.js', () => ({ enqueueCustomerNotification: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../lib/delivery-learning.js', () => ({ enqueueDeliveryLearning: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../cannabis/service.js', () => ({ checkDeliveryLimits: vi.fn().mockResolvedValue({ warnings: [] }) }));

beforeEach(() => {
  vi.clearAllMocks();
  lastUpdateSet = null;
  updateCallCount = 0;
  mockReturningInsert.mockResolvedValue([{ id: 'route-1', tenantId: 'tenant-1', name: 'Route' }]);
});

/**
 * Walk a Drizzle SQL object and return a flat list of:
 *   { type: 'string', value } for literal chunks (StringChunk.value[]), and
 *   { type: 'param',  value } for bound parameters (primitive values inlined
 *     into the `sql`...`...` template — Drizzle stores them as bare JS values
 *     in the chunk array and converts them to Param at query-build time).
 *
 * Crucially: primitives that sit directly in `queryChunks` (strings/numbers)
 * are NOT literal SQL — they are parameters. StringChunks (which carry the
 * static text between ${...} holes) are the actual raw SQL.
 */
function flattenSqlChunks(sqlObj: any): Array<{ type: string; value: any }> {
  const out: Array<{ type: string; value: any }> = [];
  const walk = (node: any) => {
    if (node == null) return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    const ctor = node?.constructor?.name;
    if (ctor === 'StringChunk' && Array.isArray(node.value)) {
      node.value.forEach((s: string) => out.push({ type: 'string', value: s }));
      return;
    }
    if (ctor === 'SQL' && node.queryChunks) { walk(node.queryChunks); return; }
    if (ctor === 'Param' && 'value' in node) { out.push({ type: 'param', value: node.value }); return; }
    // Any other value sitting directly in a chunk slot is a parameter.
    out.push({ type: 'param', value: node });
  };
  walk(sqlObj.queryChunks ?? sqlObj);
  return out;
}

describe('routes/service.createRoute — bulk UPDATE strategy', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const orderIds = [
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333',
  ];

  it('runs exactly one UPDATE for 3 orders (not 3)', async () => {
    // Pre-check returns all 3 ids → passes validation.
    txSelectFromWhere.mockResolvedValueOnce(orderIds.map(id => ({ id })));

    const { createRoute } = await import('./service.js');
    await createRoute(tenantId, {
      name: 'Bulk Route',
      orderIds,
    } as any);

    expect(updateCallCount).toBe(1);
  });

  it('builds a CASE WHEN expression that maps each id to its input index + 1', async () => {
    txSelectFromWhere.mockResolvedValueOnce(orderIds.map(id => ({ id })));

    const { createRoute } = await import('./service.js');
    await createRoute(tenantId, { name: 'Seq Route', orderIds } as any);

    expect(lastUpdateSet).toBeTruthy();
    expect(lastUpdateSet.routeId).toBe('route-1');
    expect(lastUpdateSet.status).toBe('assigned');

    // stopSequence is a SQL expression — walk it and assert the (id, seq) pairs.
    const chunks = flattenSqlChunks(lastUpdateSet.stopSequence);
    const params = chunks.filter(c => c.type === 'param').map(c => c.value);

    // The first parameter slot is the column reference (orders.id).
    // Then we expect N × (id, seq) pairs.
    const pairParams = params.slice(1);
    expect(pairParams).toEqual([
      orderIds[0], 1,
      orderIds[1], 2,
      orderIds[2], 3,
    ]);

    // And the literal SQL should contain CASE / WHEN / THEN / END tokens.
    const literalSql = chunks.filter(c => c.type === 'string').map(c => c.value).join(' ');
    expect(literalSql).toMatch(/CASE/i);
    expect(literalSql).toMatch(/WHEN/i);
    expect(literalSql).toMatch(/THEN/i);
    expect(literalSql).toMatch(/END/i);
  });

  it('skips the UPDATE entirely when orderIds is empty', async () => {
    const { createRoute } = await import('./service.js');
    await createRoute(tenantId, { name: 'Empty Route', orderIds: [] } as any);
    expect(updateCallCount).toBe(0);
  });

  it('skips the UPDATE entirely when orderIds is omitted', async () => {
    const { createRoute } = await import('./service.js');
    await createRoute(tenantId, { name: 'No Orders Route' } as any);
    expect(updateCallCount).toBe(0);
  });

  it('throws NotFoundError if pre-check finds fewer orders than supplied', async () => {
    // Only 2 of 3 ids exist for this tenant.
    txSelectFromWhere.mockResolvedValueOnce([{ id: orderIds[0] }, { id: orderIds[1] }]);

    const { createRoute } = await import('./service.js');
    await expect(
      createRoute(tenantId, { name: 'Bad Route', orderIds } as any)
    ).rejects.toThrow(/not found/i);
    // No UPDATE should have fired.
    expect(updateCallCount).toBe(0);
  });
});

describe('routes/service.createRoute — injection surface', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';

  it('does not smuggle a malicious string into raw SQL — the id is always a bound parameter', async () => {
    // Even if validation were bypassed upstream, the service path itself
    // must not interpolate user data into a SQL literal.
    const malicious = "1'; DROP TABLE orders; --";
    const realId = '44444444-4444-4444-4444-444444444444';
    const ids = [realId, malicious];

    // Pre-check: assume pre-check is satisfied (the important surface is the
    // parameterization, not the pre-check). Return both as if they existed.
    txSelectFromWhere.mockResolvedValueOnce(ids.map(id => ({ id })));

    const { createRoute } = await import('./service.js');
    await createRoute(tenantId, { name: 'Inj Route', orderIds: ids } as any);

    // Inspect the generated CASE expression's chunks.
    const chunks = flattenSqlChunks(lastUpdateSet.stopSequence);
    const literalSql = chunks.filter(c => c.type === 'string').map(c => c.value).join('');
    const params = chunks.filter(c => c.type === 'param').map(c => c.value);

    // The malicious string must be a Param (bound), never a raw literal.
    expect(params).toContain(malicious);
    expect(literalSql).not.toContain('DROP TABLE');
    expect(literalSql).not.toContain(malicious);
  });

  it('Zod createRouteSchema rejects non-UUID orderIds at the API boundary', async () => {
    const { createRouteSchema } = await import('@homer-io/shared');
    expect(() =>
      createRouteSchema.parse({
        name: 'X',
        orderIds: ["1'; DROP TABLE orders; --"],
      })
    ).toThrow();
  });
});
