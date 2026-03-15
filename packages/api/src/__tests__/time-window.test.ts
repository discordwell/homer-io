import { describe, it, expect } from 'vitest';
import { createOrderSchema } from '@homer-io/shared';

describe('Time Window Validation', () => {
  const baseOrder = {
    recipientName: 'Test',
    deliveryAddress: { street: '123 Main', city: 'Test', state: 'CA', zip: '90210' },
  };

  it('accepts valid time window (start before end)', () => {
    const result = createOrderSchema.safeParse({
      ...baseOrder,
      timeWindow: {
        start: '2026-03-15T08:00:00Z',
        end: '2026-03-15T12:00:00Z',
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid time window (start after end)', () => {
    const result = createOrderSchema.safeParse({
      ...baseOrder,
      timeWindow: {
        start: '2026-03-15T12:00:00Z',
        end: '2026-03-15T08:00:00Z',
      },
    });
    expect(result.success).toBe(false);
  });

  it('accepts missing time window', () => {
    const result = createOrderSchema.safeParse(baseOrder);
    expect(result.success).toBe(true);
  });
});
