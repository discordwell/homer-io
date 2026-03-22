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

describe('Driver invite service', () => {
  it('all invite functions are importable', async () => {
    const mod = await import('../modules/driver/invite-service.js');
    expect(mod.createDriverInvite).toBeDefined();
    expect(mod.redeemDriverInvite).toBeDefined();
    expect(mod.listDriverInvites).toBeDefined();
    expect(mod.validateInviteToken).toBeDefined();
  });
});

describe('Driver invites DB schema', () => {
  it('driver_invites table is importable', async () => {
    const { driverInvites } = await import('../lib/db/schema/driver-invites.js');
    expect(driverInvites).toBeDefined();
    expect(driverInvites.token).toBeDefined();
    expect(driverInvites.expiresAt).toBeDefined();
    expect(driverInvites.redeemedAt).toBeDefined();
    expect(driverInvites.redeemedByUserId).toBeDefined();
    expect(driverInvites.redeemedByDriverId).toBeDefined();
  });
});

describe('FTD connector', () => {
  it('is importable and implements EcommerceConnector', async () => {
    const { FTDConnector } = await import('../lib/integrations/ftd.js');
    const connector = new FTDConnector();
    expect(connector.platform).toBe('ftd');
    expect(connector.validateCredentials).toBeDefined();
    expect(connector.fetchOrders).toBeDefined();
    expect(connector.mapOrderToHomer).toBeDefined();
    expect(connector.registerWebhooks).toBeDefined();
  });

  it('maps FTD wire order with sender + gift data', async () => {
    const { FTDConnector } = await import('../lib/integrations/ftd.js');
    const connector = new FTDConnector();

    const externalOrder = {
      externalId: 'ftd-001',
      orderNumber: 'FTD-1234',
      customerName: 'Mom Johnson',
      customerEmail: null,
      customerPhone: '555-0200',
      shippingAddress: { street: '456 Oak Ave', city: 'Portland', state: 'OR', zip: '97201', country: 'US' },
      lineItems: [
        { name: 'Dozen Red Roses', quantity: 1, price: 65.00 },
        { name: 'Box of Chocolates', quantity: 1, price: 25.00 },
      ],
      totalWeight: null,
      notes: 'Leave at door',
      createdAt: '2026-03-22T00:00:00Z',
      rawData: {
        id: 'ftd-001',
        orderNumber: 'FTD-1234',
        recipientName: 'Mom Johnson',
        recipientPhone: '555-0200',
        senderName: 'Sarah Johnson',
        senderEmail: 'sarah@example.com',
        senderPhone: '555-0100',
        cardMessage: 'Happy Birthday Mom! Love always, Sarah',
        deliveryAddress: { street: '456 Oak Ave', city: 'Portland', state: 'OR', zip: '97201' },
        items: [
          { description: 'Dozen Red Roses', quantity: 1, price: 65.00 },
          { description: 'Box of Chocolates', quantity: 1, price: 25.00 },
        ],
      },
    };

    const mapped = connector.mapOrderToHomer(externalOrder, 'tenant-123');
    expect(mapped.recipientName).toBe('Mom Johnson');
    expect(mapped.senderName).toBe('Sarah Johnson');
    expect(mapped.senderEmail).toBe('sarah@example.com');
    expect(mapped.giftMessage).toBe('Happy Birthday Mom! Love always, Sarah');
    expect(mapped.isGift).toBe(true);
    expect(mapped.requiresPhoto).toBe(true);
    expect(mapped.packageCount).toBe(2);
  });
});

describe('Teleflora connector', () => {
  it('is importable and implements EcommerceConnector', async () => {
    const { TelefloraConnector } = await import('../lib/integrations/teleflora.js');
    const connector = new TelefloraConnector();
    expect(connector.platform).toBe('teleflora');
    expect(connector.validateCredentials).toBeDefined();
    expect(connector.fetchOrders).toBeDefined();
    expect(connector.mapOrderToHomer).toBeDefined();
  });

  it('maps Teleflora wire order with sender + gift data', async () => {
    const { TelefloraConnector } = await import('../lib/integrations/teleflora.js');
    const connector = new TelefloraConnector();

    const externalOrder = {
      externalId: 'tf-001',
      orderNumber: 'TF-5678',
      customerName: 'Dad Smith',
      customerEmail: 'dad@example.com',
      customerPhone: '555-0300',
      shippingAddress: { street: '789 Elm St', city: 'Seattle', state: 'WA', zip: '98101', country: 'US' },
      lineItems: [{ name: 'Spring Bouquet', quantity: 1, price: 55.00 }],
      totalWeight: null,
      notes: null,
      createdAt: '2026-03-22T00:00:00Z',
      rawData: {
        id: 'tf-001',
        orderNumber: 'TF-5678',
        sender: { name: 'Tim Smith', email: 'tim@example.com', phone: '555-0400' },
        recipient: {
          name: 'Dad Smith',
          email: 'dad@example.com',
          phone: '555-0300',
          address: { street: '789 Elm St', city: 'Seattle', state: 'WA', zip: '98101' },
        },
        cardMessage: "Happy Father's Day! — Tim & family",
        items: [{ name: 'Spring Bouquet', quantity: 1, price: 55.00 }],
      },
    };

    const mapped = connector.mapOrderToHomer(externalOrder, 'tenant-456');
    expect(mapped.recipientName).toBe('Dad Smith');
    expect(mapped.senderName).toBe('Tim Smith');
    expect(mapped.senderEmail).toBe('tim@example.com');
    expect(mapped.giftMessage).toBe("Happy Father's Day! — Tim & family");
    expect(mapped.isGift).toBe(true);
  });
});

describe('Integration index', () => {
  it('FTD connector is registered', async () => {
    const { getConnector } = await import('../lib/integrations/index.js');
    expect(getConnector('ftd').platform).toBe('ftd');
  });

  it('Teleflora connector is registered', async () => {
    const { getConnector } = await import('../lib/integrations/index.js');
    expect(getConnector('teleflora').platform).toBe('teleflora');
  });

  it('FTD and Teleflora have florist industry gate', async () => {
    const { getAvailablePlatforms } = await import('../lib/integrations/index.js');
    const platforms = getAvailablePlatforms();
    const ftd = platforms.find(p => p.platform === 'ftd');
    const teleflora = platforms.find(p => p.platform === 'teleflora');
    expect(ftd).toBeDefined();
    expect(ftd!.industryGate).toBe('florist');
    expect(teleflora).toBeDefined();
    expect(teleflora!.industryGate).toBe('florist');
  });

  it('platform enum accepts ftd and teleflora', async () => {
    const { integrationPlatformEnum } = await import('@homer-io/shared');
    expect(integrationPlatformEnum.parse('ftd')).toBe('ftd');
    expect(integrationPlatformEnum.parse('teleflora')).toBe('teleflora');
  });
});
