import { describe, it, expect } from 'vitest';
import { batchOrderStatusSchema, batchDriverAssignSchema } from '@homer-io/shared';

describe('Batch Operations - Order Status Schema', () => {
  it('accepts valid batch status update', () => {
    const result = batchOrderStatusSchema.parse({
      orderIds: ['550e8400-e29b-41d4-a716-446655440000'],
      status: 'delivered',
    });
    expect(result.orderIds).toHaveLength(1);
    expect(result.status).toBe('delivered');
  });

  it('accepts multiple order IDs', () => {
    const ids = Array.from({ length: 10 }, (_, i) =>
      `550e8400-e29b-41d4-a716-44665544000${i}`,
    );
    const result = batchOrderStatusSchema.parse({
      orderIds: ids,
      status: 'assigned',
    });
    expect(result.orderIds).toHaveLength(10);
  });

  it('accepts max 100 order IDs', () => {
    const ids = Array.from({ length: 100 }, (_, i) =>
      `550e8400-e29b-41d4-a716-${String(i).padStart(12, '0')}`,
    );
    const result = batchOrderStatusSchema.parse({
      orderIds: ids,
      status: 'in_transit',
    });
    expect(result.orderIds).toHaveLength(100);
  });

  it('rejects more than 100 order IDs', () => {
    const ids = Array.from({ length: 101 }, (_, i) =>
      `550e8400-e29b-41d4-a716-${String(i).padStart(12, '0')}`,
    );
    expect(() => batchOrderStatusSchema.parse({
      orderIds: ids,
      status: 'delivered',
    })).toThrow();
  });

  it('rejects empty order IDs', () => {
    expect(() => batchOrderStatusSchema.parse({
      orderIds: [],
      status: 'delivered',
    })).toThrow();
  });

  it('rejects non-UUID order IDs', () => {
    expect(() => batchOrderStatusSchema.parse({
      orderIds: ['not-a-uuid'],
      status: 'delivered',
    })).toThrow();
  });

  it('rejects invalid status', () => {
    expect(() => batchOrderStatusSchema.parse({
      orderIds: ['550e8400-e29b-41d4-a716-446655440000'],
      status: 'invalid_status',
    })).toThrow();
  });

  it('accepts all valid statuses', () => {
    const statuses = ['received', 'assigned', 'in_transit', 'delivered', 'failed', 'returned'];
    for (const status of statuses) {
      const result = batchOrderStatusSchema.parse({
        orderIds: ['550e8400-e29b-41d4-a716-446655440000'],
        status,
      });
      expect(result.status).toBe(status);
    }
  });
});

describe('Batch Operations - Driver Assign Schema', () => {
  it('accepts valid batch assign', () => {
    const result = batchDriverAssignSchema.parse({
      orderIds: ['550e8400-e29b-41d4-a716-446655440000'],
      routeId: '660e8400-e29b-41d4-a716-446655440001',
    });
    expect(result.orderIds).toHaveLength(1);
    expect(result.routeId).toBe('660e8400-e29b-41d4-a716-446655440001');
  });

  it('accepts multiple order IDs for assignment', () => {
    const ids = [
      '550e8400-e29b-41d4-a716-446655440000',
      '550e8400-e29b-41d4-a716-446655440001',
      '550e8400-e29b-41d4-a716-446655440002',
    ];
    const result = batchDriverAssignSchema.parse({
      orderIds: ids,
      routeId: '660e8400-e29b-41d4-a716-446655440001',
    });
    expect(result.orderIds).toHaveLength(3);
  });

  it('rejects empty order IDs', () => {
    expect(() => batchDriverAssignSchema.parse({
      orderIds: [],
      routeId: '660e8400-e29b-41d4-a716-446655440001',
    })).toThrow();
  });

  it('rejects more than 100 order IDs', () => {
    const ids = Array.from({ length: 101 }, (_, i) =>
      `550e8400-e29b-41d4-a716-${String(i).padStart(12, '0')}`,
    );
    expect(() => batchDriverAssignSchema.parse({
      orderIds: ids,
      routeId: '660e8400-e29b-41d4-a716-446655440001',
    })).toThrow();
  });

  it('rejects non-UUID route ID', () => {
    expect(() => batchDriverAssignSchema.parse({
      orderIds: ['550e8400-e29b-41d4-a716-446655440000'],
      routeId: 'not-a-uuid',
    })).toThrow();
  });

  it('rejects missing route ID', () => {
    expect(() => batchDriverAssignSchema.parse({
      orderIds: ['550e8400-e29b-41d4-a716-446655440000'],
    })).toThrow();
  });
});
