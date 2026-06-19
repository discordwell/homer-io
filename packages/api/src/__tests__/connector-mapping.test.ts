import { describe, it, expect } from 'vitest';
import { SquareConnector } from '../lib/integrations/square.js';
import type { ExternalOrder } from '../lib/integrations/connector.js';

// mapOrderToHomer is the user/driver-facing mapping step. ExternalOrder.lineItems
// carry prices already converted to DOLLARS by each connector's toExternal(); the
// notes summary must render them as-is (a regression here once divided by 100 a
// second time, rendering a $12.00 item as "$0.12").

function makeExternalOrder(overrides: Partial<ExternalOrder> = {}): ExternalOrder {
  return {
    externalId: 'sq_1',
    orderNumber: '1001',
    customerName: 'Jane Doe',
    customerEmail: 'jane@example.com',
    customerPhone: '+15555550123',
    shippingAddress: {
      street: '123 Main St',
      city: 'Austin',
      state: 'TX',
      zip: '78701',
      country: 'US',
    },
    lineItems: [
      { name: 'Margherita Pizza', quantity: 2, price: 12.0 },
      { name: 'Soda', quantity: 1, price: 2.5 },
    ],
    totalWeight: null,
    notes: null,
    createdAt: '2026-01-01T00:00:00Z',
    rawData: {},
    ...overrides,
  };
}

describe('SquareConnector.mapOrderToHomer', () => {
  const connector = new SquareConnector();

  it('renders line-item prices in dollars without re-dividing by 100', () => {
    const mapped = connector.mapOrderToHomer(makeExternalOrder(), 'tenant-1');
    // $12.00, not $0.12
    expect(mapped.notes).toContain('2x Margherita Pizza ($12.00)');
    expect(mapped.notes).toContain('1x Soda ($2.50)');
    expect(mapped.notes).not.toContain('$0.12');
  });

  it('omits the price annotation when a line item has no price', () => {
    const mapped = connector.mapOrderToHomer(
      makeExternalOrder({ lineItems: [{ name: 'Mystery Item', quantity: 1 }] }),
      'tenant-1',
    );
    expect(mapped.notes).toContain('1x Mystery Item');
    expect(mapped.notes).not.toContain('$');
  });

  it('derives package count from total item quantity', () => {
    const mapped = connector.mapOrderToHomer(makeExternalOrder(), 'tenant-1');
    // 3 items, ceil(3/5) -> 1
    expect(mapped.packageCount).toBe(1);
    expect(mapped.externalId).toBe('square_sq_1');
  });
});
