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

describe('Florist order schemas', () => {
  it('createOrderSchema accepts sender + gift fields', async () => {
    const { createOrderSchema } = await import('@homer-io/shared');
    const result = createOrderSchema.parse({
      recipientName: 'Mom',
      deliveryAddress: { street: '123 Main St', city: 'SF', state: 'CA', zip: '94102' },
      senderName: 'Sarah Johnson',
      senderEmail: 'sarah@example.com',
      senderPhone: '555-0123',
      giftMessage: 'Happy Birthday Mom! Love, Sarah',
      isGift: true,
    });
    expect(result.senderName).toBe('Sarah Johnson');
    expect(result.senderEmail).toBe('sarah@example.com');
    expect(result.giftMessage).toBe('Happy Birthday Mom! Love, Sarah');
    expect(result.isGift).toBe(true);
  });

  it('createOrderSchema defaults isGift to false', async () => {
    const { createOrderSchema } = await import('@homer-io/shared');
    const result = createOrderSchema.parse({
      recipientName: 'John',
      deliveryAddress: { street: '123 Main St', city: 'SF', state: 'CA', zip: '94102' },
    });
    expect(result.isGift).toBe(false);
    expect(result.senderName).toBeUndefined();
    expect(result.giftMessage).toBeUndefined();
  });

  it('giftMessage allows up to 2000 chars', async () => {
    const { createOrderSchema } = await import('@homer-io/shared');
    const longMsg = 'x'.repeat(2000);
    const result = createOrderSchema.parse({
      recipientName: 'Test',
      deliveryAddress: { street: '123 Main', city: 'SF', state: 'CA', zip: '94102' },
      giftMessage: longMsg,
    });
    expect(result.giftMessage).toHaveLength(2000);
  });

  it('giftMessage rejects over 2000 chars', async () => {
    const { createOrderSchema } = await import('@homer-io/shared');
    expect(() => createOrderSchema.parse({
      recipientName: 'Test',
      deliveryAddress: { street: '123 Main', city: 'SF', state: 'CA', zip: '94102' },
      giftMessage: 'x'.repeat(2001),
    })).toThrow();
  });
});

describe('Notification template schemas', () => {
  it('createNotificationTemplateSchema accepts recipientType', async () => {
    const { createNotificationTemplateSchema } = await import('@homer-io/shared');
    const result = createNotificationTemplateSchema.parse({
      trigger: 'delivered',
      channel: 'email',
      subject: 'Your flowers have been delivered!',
      bodyTemplate: 'Hi {{senderName}}, your flowers for {{recipientName}} have arrived! {{deliveryPhotoUrl}}',
      recipientType: 'sender',
    });
    expect(result.recipientType).toBe('sender');
  });

  it('recipientType defaults to recipient', async () => {
    const { createNotificationTemplateSchema } = await import('@homer-io/shared');
    const result = createNotificationTemplateSchema.parse({
      trigger: 'delivered',
      channel: 'sms',
      bodyTemplate: 'Your delivery is complete!',
    });
    expect(result.recipientType).toBe('recipient');
  });

  it('recipientType accepts both', async () => {
    const { createNotificationTemplateSchema } = await import('@homer-io/shared');
    const result = createNotificationTemplateSchema.parse({
      trigger: 'delivered',
      channel: 'email',
      bodyTemplate: 'Delivery complete!',
      recipientType: 'both',
    });
    expect(result.recipientType).toBe('both');
  });

  it('recipientType rejects invalid values', async () => {
    const { createNotificationTemplateSchema } = await import('@homer-io/shared');
    expect(() => createNotificationTemplateSchema.parse({
      trigger: 'delivered',
      channel: 'sms',
      bodyTemplate: 'test',
      recipientType: 'nobody',
    })).toThrow();
  });
});

describe('Order DB schema sender columns', () => {
  it('orders table has sender and gift columns', async () => {
    const { orders } = await import('../lib/db/schema/orders.js');
    expect(orders.senderName).toBeDefined();
    expect(orders.senderEmail).toBeDefined();
    expect(orders.senderPhone).toBeDefined();
    expect(orders.giftMessage).toBeDefined();
    expect(orders.isGift).toBeDefined();
  });
});

describe('Notification template recipientType column', () => {
  it('notification_templates has recipientType column', async () => {
    const { notificationTemplates } = await import('../lib/db/schema/notification-templates.js');
    expect(notificationTemplates.recipientType).toBeDefined();
  });
});

describe('Florist demo data', () => {
  it('generates florist orders with sender/gift data', async () => {
    const { generateIndustryOrders } = await import('../modules/auth/industry-data.js');
    const { BAY_AREA_LOCATIONS } = await import('../modules/auth/demo-seed.js');
    const orders = generateIndustryOrders('florist', 20, BAY_AREA_LOCATIONS.slice(0, 5));
    expect(orders.length).toBe(20);

    // At least some orders should be gifts (80% probability, so statistically ~16/20)
    const gifts = orders.filter(o => o.isGift);
    expect(gifts.length).toBeGreaterThan(5);

    // Gift orders should have sender data
    for (const gift of gifts) {
      expect(gift.senderName).toBeDefined();
      expect(gift.senderEmail).toBeDefined();
      expect(gift.giftMessage).toBeDefined();
      expect(gift.giftMessage!.length).toBeGreaterThan(0);
    }
  });

  it('non-gift florist orders have no sender data', async () => {
    const { generateIndustryOrders } = await import('../modules/auth/industry-data.js');
    const { BAY_AREA_LOCATIONS } = await import('../modules/auth/demo-seed.js');
    const orders = generateIndustryOrders('florist', 50, BAY_AREA_LOCATIONS.slice(0, 5));
    const nonGifts = orders.filter(o => !o.isGift);
    // Some should be non-gifts (20% probability)
    for (const order of nonGifts) {
      expect(order.senderName).toBeUndefined();
    }
  });

  it('non-florist industries do not generate sender data', async () => {
    const { generateIndustryOrders } = await import('../modules/auth/industry-data.js');
    const { BAY_AREA_LOCATIONS } = await import('../modules/auth/demo-seed.js');
    const orders = generateIndustryOrders('courier', 10, BAY_AREA_LOCATIONS.slice(0, 5));
    for (const order of orders) {
      expect(order.senderName).toBeUndefined();
      expect(order.isGift).toBeUndefined();
    }
  });
});

describe('Public tracking response', () => {
  it('getPublicTracking function is importable', async () => {
    const { getPublicTracking } = await import('../modules/public/service.js');
    expect(getPublicTracking).toBeDefined();
  });
});
