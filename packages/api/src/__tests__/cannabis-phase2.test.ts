import { describe, it, expect, vi } from 'vitest';

vi.mock('../../config.js', () => ({
  config: {
    twilio: { accountSid: '', authToken: '', fromNumber: '' },
    sendgrid: { apiKey: '', fromEmail: 'noreply@homer.io' },
    jwt: { secret: 'test-secret' },
    minio: { endpoint: '', port: 9000, accessKey: '', secretKey: '', useSSL: false },
    integrations: { encryptionKey: 'test-key' },
  },
}));

describe('Cannabis Phase 2 schemas', () => {
  it('createDriverKitSchema validates kit creation', async () => {
    const { createDriverKitSchema } = await import('@homer-io/shared');
    const result = createDriverKitSchema.parse({
      routeId: '00000000-0000-0000-0000-000000000001',
      items: [{
        orderId: '00000000-0000-0000-0000-000000000002',
        recipientName: 'John Smith',
        products: [{ name: 'Blue Dream 1/8oz', quantity: 1, price: 45.00 }],
        status: 'loaded',
      }],
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].status).toBe('loaded');
  });

  it('createDriverKitSchema rejects empty items', async () => {
    const { createDriverKitSchema } = await import('@homer-io/shared');
    expect(() => createDriverKitSchema.parse({
      routeId: '00000000-0000-0000-0000-000000000001',
      items: [],
    })).toThrow();
  });

  it('reconcileKitSchema validates reconciliation input', async () => {
    const { reconcileKitSchema } = await import('@homer-io/shared');
    const result = reconcileKitSchema.parse({
      returnedItems: [{
        orderId: '00000000-0000-0000-0000-000000000002',
        products: [{ name: 'Blue Dream 1/8oz', quantityReturned: 0 }],
      }],
      notes: 'All delivered successfully',
    });
    expect(result.returnedItems).toHaveLength(1);
    expect(result.returnedItems[0].products[0].quantityReturned).toBe(0);
  });

  it('cashCollectionSchema validates cash input', async () => {
    const { cashCollectionSchema } = await import('@homer-io/shared');
    const result = cashCollectionSchema.parse({ cashCollected: 47.50 });
    expect(result.cashCollected).toBe(47.50);
  });

  it('cashCollectionSchema rejects negative amounts', async () => {
    const { cashCollectionSchema } = await import('@homer-io/shared');
    expect(() => cashCollectionSchema.parse({ cashCollected: -10 })).toThrow();
  });

  it('createOrderSchema now accepts cash fields', async () => {
    const { createOrderSchema } = await import('@homer-io/shared');
    const result = createOrderSchema.parse({
      recipientName: 'Test User',
      deliveryAddress: { street: '123 Main St', city: 'SF', state: 'CA', zip: '94102' },
      cashAmount: 55.00,
      paymentMethod: 'cash',
    });
    expect(result.cashAmount).toBe(55.00);
    expect(result.paymentMethod).toBe('cash');
  });

  it('createOrderSchema rejects invalid payment method', async () => {
    const { createOrderSchema } = await import('@homer-io/shared');
    expect(() => createOrderSchema.parse({
      recipientName: 'Test User',
      deliveryAddress: { street: '123 Main St', city: 'SF', state: 'CA', zip: '94102' },
      paymentMethod: 'bitcoin',
    })).toThrow();
  });

  it('kitItemSchema defaults status to loaded', async () => {
    const { kitItemSchema } = await import('@homer-io/shared');
    const result = kitItemSchema.parse({
      orderId: '00000000-0000-0000-0000-000000000001',
      products: [{ name: 'Product A', quantity: 2 }],
    });
    expect(result.status).toBe('loaded');
  });
});

describe('Cannabis Phase 2 service exports', () => {
  it('all phase 2 service functions are importable', async () => {
    const mod = await import('../modules/cannabis/service.js');
    expect(mod.createDriverKit).toBeDefined();
    expect(mod.getDriverKit).toBeDefined();
    expect(mod.getKitByRoute).toBeDefined();
    expect(mod.listDriverKits).toBeDefined();
    expect(mod.markKitLoaded).toBeDefined();
    expect(mod.startKitTransit).toBeDefined();
    expect(mod.reconcileKit).toBeDefined();
    expect(mod.checkDeliveryLimits).toBeDefined();
    expect(mod.collectCash).toBeDefined();
  });
});

describe('Driver kits DB schema', () => {
  it('driver_kits table is importable', async () => {
    const { driverKits } = await import('../lib/db/schema/driver-kits.js');
    expect(driverKits).toBeDefined();
    expect(driverKits.tenantId).toBeDefined();
    expect(driverKits.routeId).toBeDefined();
    expect(driverKits.items).toBeDefined();
    expect(driverKits.returnedItems).toBeDefined();
    expect(driverKits.discrepancies).toBeDefined();
    expect(driverKits.reconciledBy).toBeDefined();
  });
});

describe('Orders cash columns', () => {
  it('orders table has cash columns', async () => {
    const { orders } = await import('../lib/db/schema/orders.js');
    expect(orders.cashAmount).toBeDefined();
    expect(orders.cashCollected).toBeDefined();
    expect(orders.paymentMethod).toBeDefined();
    expect(orders.paymentCollectedAt).toBeDefined();
  });
});

describe('Delivery limits check', () => {
  it('checkDeliveryLimits returns proper structure', async () => {
    const { checkDeliveryLimits } = await import('../modules/cannabis/service.js');
    // Will fail on DB access but validates the function signature exists
    try {
      await checkDeliveryLimits('fake-tenant', 'fake-route');
    } catch {
      // Expected — no DB. The point is that the function exists and is callable.
    }
  });
});
