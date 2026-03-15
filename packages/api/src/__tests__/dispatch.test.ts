import { describe, it, expect } from 'vitest';
import { autoDispatchRequestSchema, confirmDispatchSchema } from '@homer-io/shared';

describe('Dispatch - Auto-Dispatch Request Schema', () => {
  it('accepts empty request with defaults', () => {
    const result = autoDispatchRequestSchema.parse({});
    expect(result.maxOrdersPerRoute).toBe(50);
    expect(result.prioritizeUrgent).toBe(true);
  });

  it('accepts full request', () => {
    const result = autoDispatchRequestSchema.parse({
      date: '2026-03-14T00:00:00Z',
      maxOrdersPerRoute: 25,
      prioritizeUrgent: false,
    });
    expect(result.date).toBe('2026-03-14T00:00:00Z');
    expect(result.maxOrdersPerRoute).toBe(25);
    expect(result.prioritizeUrgent).toBe(false);
  });

  it('rejects maxOrdersPerRoute below 1', () => {
    expect(() => autoDispatchRequestSchema.parse({
      maxOrdersPerRoute: 0,
    })).toThrow();
  });

  it('rejects maxOrdersPerRoute above 200', () => {
    expect(() => autoDispatchRequestSchema.parse({
      maxOrdersPerRoute: 201,
    })).toThrow();
  });

  it('rejects non-integer maxOrdersPerRoute', () => {
    expect(() => autoDispatchRequestSchema.parse({
      maxOrdersPerRoute: 10.5,
    })).toThrow();
  });

  it('rejects invalid date format', () => {
    expect(() => autoDispatchRequestSchema.parse({
      date: 'not-a-date',
    })).toThrow();
  });
});

describe('Dispatch - Confirm Schema', () => {
  it('accepts valid route IDs', () => {
    const result = confirmDispatchSchema.parse({
      routeIds: ['550e8400-e29b-41d4-a716-446655440000'],
    });
    expect(result.routeIds).toHaveLength(1);
  });

  it('accepts multiple route IDs', () => {
    const result = confirmDispatchSchema.parse({
      routeIds: [
        '550e8400-e29b-41d4-a716-446655440000',
        '660e8400-e29b-41d4-a716-446655440001',
      ],
    });
    expect(result.routeIds).toHaveLength(2);
  });

  it('rejects empty routeIds', () => {
    expect(() => confirmDispatchSchema.parse({
      routeIds: [],
    })).toThrow();
  });

  it('rejects non-UUID routeIds', () => {
    expect(() => confirmDispatchSchema.parse({
      routeIds: ['not-a-uuid'],
    })).toThrow();
  });
});
