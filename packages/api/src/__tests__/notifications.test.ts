import { describe, it, expect } from 'vitest';
import { notificationSchema, notificationPrefsSchema, notificationTypeEnum } from '@homer-io/shared';

describe('Notifications - Type Enum', () => {
  const validTypes = [
    'delivery_completed', 'delivery_failed', 'route_started', 'route_completed',
    'driver_offline', 'system', 'team_invite', 'order_received',
  ];

  it('accepts all valid notification types', () => {
    for (const type of validTypes) {
      expect(notificationTypeEnum.parse(type)).toBe(type);
    }
  });

  it('rejects invalid type', () => {
    expect(() => notificationTypeEnum.parse('email_sent')).toThrow();
    expect(() => notificationTypeEnum.parse('')).toThrow();
  });
});

describe('Notifications - Schema', () => {
  it('validates a complete notification', () => {
    const notification = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      type: 'delivery_completed',
      title: 'Order Delivered',
      body: 'Order #456 was delivered to John D.',
      data: { orderId: '123', routeId: '456' },
      readAt: '2026-03-14T10:00:00Z',
      createdAt: '2026-03-14T09:00:00Z',
    };
    const result = notificationSchema.parse(notification);
    expect(result.title).toBe('Order Delivered');
    expect(result.readAt).toBe('2026-03-14T10:00:00Z');
  });

  it('accepts null readAt for unread notifications', () => {
    const result = notificationSchema.parse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      type: 'system',
      title: 'Welcome',
      body: 'Welcome to HOMER.io',
      readAt: null,
      createdAt: '2026-03-14T00:00:00Z',
    });
    expect(result.readAt).toBeNull();
  });

  it('defaults data to empty object', () => {
    const result = notificationSchema.parse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      type: 'system',
      title: 'Test',
      body: 'Test body',
      readAt: null,
      createdAt: '2026-03-14T00:00:00Z',
    });
    expect(result.data).toEqual({});
  });
});

describe('Notifications - Preferences', () => {
  it('uses true as default for all preferences', () => {
    const result = notificationPrefsSchema.parse({});
    expect(result.deliveryUpdates).toBe(true);
    expect(result.routeUpdates).toBe(true);
    expect(result.driverAlerts).toBe(true);
    expect(result.systemNotices).toBe(true);
  });

  it('allows selective disabling', () => {
    const result = notificationPrefsSchema.parse({
      deliveryUpdates: false,
      systemNotices: false,
    });
    expect(result.deliveryUpdates).toBe(false);
    expect(result.routeUpdates).toBe(true);
    expect(result.driverAlerts).toBe(true);
    expect(result.systemNotices).toBe(false);
  });
});
