/**
 * Unit tests for orders/service.ts batchAssignToRoute bulk UPDATE strategy.
 *
 * Asserts:
 *   1) batchAssignToRoute does exactly ONE UPDATE on the orders table
 *      for N input ids (not N).
 *   2) The CASE expression applies sequential stopSequence values, offset
 *      by the current max-sequence on the route (append semantics preserved).
 *   3) Empty input is a no-op.
 *   4) Orphan ids (not belonging to tenant) cause a NotFoundError before any
 *      mutation fires.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

let ordersUpdateCount = 0;
let lastOrdersUpdateSet: any = null;

// tx.select chain — must be programmable per-call (pre-check, then maxSeq, then count)
let txSelectQueue: any[] = [];

const makeSelect = () => ({
  from: vi.fn().mockReturnValue({
    where: vi.fn().mockImplementation(() => {
      // pop next result
      const next = txSelectQueue.shift();
      return Promise.resolve(next ?? []);
    }),
  }),
});

const mockTx: any = {
  select: vi.fn().mockImplementation(makeSelect),
  update: vi.fn().mockImplementation((table: any) => ({
    set: vi.fn().mockImplementation((values: any) => {
      // Only track updates against the `orders` identity
      if (table && table.__kind === 'orders') {
        ordersUpdateCount++;
        lastOrdersUpdateSet = values;
      }
      return { where: vi.fn().mockResolvedValue(undefined) };
    }),
  })),
};

const mockDb = {
  transaction: vi.fn().mockImplementation(async (fn: any) => fn(mockTx)),
};

vi.mock('../../lib/db/index.js', () => ({ db: mockDb }));

// Tag the schema objects so the mock update tracker can distinguish
// `orders` vs `routes`.
vi.mock('../../lib/db/schema/orders.js', () => ({
  orders: {
    __kind: 'orders',
    id: 'id', tenantId: 'tenant_id', routeId: 'route_id',
    stopSequence: 'stop_sequence', status: 'status', updatedAt: 'updated_at',
    recipientName: 'recipient_name', createdAt: 'created_at',
    completedAt: 'completed_at', priority: 'priority',
  },
  orderStatusEnum: { enumValues: ['received', 'assigned', 'in_transit', 'delivered', 'failed', 'returned'] },
}));
vi.mock('../../lib/db/schema/routes.js', () => ({
  routes: { __kind: 'routes', id: 'id', tenantId: 'tenant_id', totalStops: 'total_stops', updatedAt: 'updated_at' },
}));
vi.mock('../../lib/db/schema/tenants.js', () => ({ tenants: { id: 'id', industry: 'industry', settings: 'settings' } }));
vi.mock('../../lib/errors.js', () => ({
  NotFoundError: class NotFoundError extends Error {
    constructor(msg: string) { super(msg); this.name = 'NotFoundError'; }
  },
}));
vi.mock('../../lib/activity.js', () => ({ logActivity: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../cannabis/service.js', () => ({ checkDeliveryZone: vi.fn().mockResolvedValue({ allowed: true }) }));

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

beforeEach(() => {
  vi.clearAllMocks();
  ordersUpdateCount = 0;
  lastOrdersUpdateSet = null;
  txSelectQueue = [];
});

describe('orders/service.batchAssignToRoute — bulk UPDATE strategy', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const routeId = '99999999-9999-9999-9999-999999999999';
  const orderIds = [
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333',
  ];

  it('runs exactly one UPDATE on orders for 3 ids (not 3)', async () => {
    txSelectQueue = [
      orderIds.map(id => ({ id })),   // pre-check
      [{ max: 0 }],                   // maxSeq
      [{ count: 3 }],                 // count for route totalStops
    ];

    const { batchAssignToRoute } = await import('./service.js');
    await batchAssignToRoute(tenantId, orderIds, routeId);

    expect(ordersUpdateCount).toBe(1);
  });

  it('sequences orders per input-array order, offset by current max', async () => {
    txSelectQueue = [
      orderIds.map(id => ({ id })),
      [{ max: 5 }],  // existing sequences go up to 5; new assignments start at 6
      [{ count: 3 }],
    ];

    const { batchAssignToRoute } = await import('./service.js');
    await batchAssignToRoute(tenantId, orderIds, routeId);

    expect(lastOrdersUpdateSet).toBeTruthy();
    expect(lastOrdersUpdateSet.routeId).toBe(routeId);
    expect(lastOrdersUpdateSet.status).toBe('assigned');

    const chunks = flattenSqlChunks(lastOrdersUpdateSet.stopSequence);
    const params = chunks.filter(c => c.type === 'param').map(c => c.value);

    // With baseSeq=5: id0→6, id1→7, id2→8
    // (first param is the column reference CASE ${orders.id})
    expect(params.slice(1)).toEqual([
      orderIds[0], 6,
      orderIds[1], 7,
      orderIds[2], 8,
    ]);
  });

  it('sequences from 1 when route is empty (max is 0)', async () => {
    txSelectQueue = [
      orderIds.map(id => ({ id })),
      [{ max: 0 }],
      [{ count: 3 }],
    ];

    const { batchAssignToRoute } = await import('./service.js');
    await batchAssignToRoute(tenantId, orderIds, routeId);

    const chunks = flattenSqlChunks(lastOrdersUpdateSet.stopSequence);
    const params = chunks.filter(c => c.type === 'param').map(c => c.value);
    expect(params.slice(1)).toEqual([
      orderIds[0], 1,
      orderIds[1], 2,
      orderIds[2], 3,
    ]);
  });

  it('is a no-op (no transaction, no update) when orderIds is empty', async () => {
    const { batchAssignToRoute } = await import('./service.js');
    const result = await batchAssignToRoute(tenantId, [], routeId);
    expect(result).toEqual({ assigned: 0 });
    expect(ordersUpdateCount).toBe(0);
    expect(mockDb.transaction).not.toHaveBeenCalled();
  });

  it('throws NotFoundError when pre-check finds fewer ids than supplied (cross-tenant leak protection)', async () => {
    txSelectQueue = [
      [{ id: orderIds[0] }, { id: orderIds[1] }],  // only 2 of 3 belong to tenant
    ];

    const { batchAssignToRoute } = await import('./service.js');
    await expect(
      batchAssignToRoute(tenantId, orderIds, routeId)
    ).rejects.toThrow(/not found/i);

    // Critical: no UPDATE may have fired.
    expect(ordersUpdateCount).toBe(0);
  });
});

describe('orders/service.batchAssignToRoute — injection surface', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const routeId = '99999999-9999-9999-9999-999999999999';

  it('binds ids as parameters; raw SQL does not contain the user-supplied string', async () => {
    const malicious = "1'; DROP TABLE orders; --";
    const realId = '55555555-5555-5555-5555-555555555555';
    const ids = [realId, malicious];

    txSelectQueue = [
      ids.map(id => ({ id })),
      [{ max: 0 }],
      [{ count: 2 }],
    ];

    const { batchAssignToRoute } = await import('./service.js');
    await batchAssignToRoute(tenantId, ids, routeId);

    const chunks = flattenSqlChunks(lastOrdersUpdateSet.stopSequence);
    const literalSql = chunks.filter(c => c.type === 'string').map(c => c.value).join('');
    const params = chunks.filter(c => c.type === 'param').map(c => c.value);

    expect(params).toContain(malicious);
    expect(literalSql).not.toContain('DROP TABLE');
    expect(literalSql).not.toContain(malicious);
  });

  it('Zod batchDriverAssignSchema rejects non-UUID orderIds at the API boundary', async () => {
    const { batchDriverAssignSchema } = await import('@homer-io/shared');
    expect(() =>
      batchDriverAssignSchema.parse({
        orderIds: ["1'; DROP TABLE orders; --"],
        routeId: '99999999-9999-9999-9999-999999999999',
      })
    ).toThrow();
  });
});
