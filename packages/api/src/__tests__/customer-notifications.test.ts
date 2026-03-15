import { describe, it, expect } from 'vitest';
import { createNotificationTemplateSchema, updateNotificationTemplateSchema } from '@homer-io/shared';

describe('Customer Notifications - Template Schema Validation', () => {
  it('accepts valid template creation input', () => {
    const result = createNotificationTemplateSchema.parse({
      trigger: 'delivered',
      channel: 'sms',
      bodyTemplate: 'Hi {{recipientName}}, your order {{orderRef}} has been delivered!',
    });
    expect(result.trigger).toBe('delivered');
    expect(result.channel).toBe('sms');
    expect(result.isActive).toBe(true);
  });

  it('accepts email template with subject', () => {
    const result = createNotificationTemplateSchema.parse({
      trigger: 'driver_en_route',
      channel: 'email',
      subject: 'Your delivery is on its way!',
      bodyTemplate: 'Hi {{recipientName}}, {{driverName}} is headed your way. ETA: {{eta}}',
      isActive: true,
    });
    expect(result.subject).toBe('Your delivery is on its way!');
  });

  it('rejects invalid trigger', () => {
    expect(() => createNotificationTemplateSchema.parse({
      trigger: 'invalid_trigger',
      channel: 'sms',
      bodyTemplate: 'Hello',
    })).toThrow();
  });

  it('rejects invalid channel', () => {
    expect(() => createNotificationTemplateSchema.parse({
      trigger: 'delivered',
      channel: 'push',
      bodyTemplate: 'Hello',
    })).toThrow();
  });

  it('rejects empty body template', () => {
    expect(() => createNotificationTemplateSchema.parse({
      trigger: 'delivered',
      channel: 'sms',
      bodyTemplate: '',
    })).toThrow();
  });

  it('rejects body template exceeding 2000 chars', () => {
    expect(() => createNotificationTemplateSchema.parse({
      trigger: 'delivered',
      channel: 'sms',
      bodyTemplate: 'x'.repeat(2001),
    })).toThrow();
  });

  it('accepts all valid triggers', () => {
    const triggers = ['order_assigned', 'driver_en_route', 'delivery_approaching', 'delivered', 'failed'];
    for (const trigger of triggers) {
      const result = createNotificationTemplateSchema.parse({
        trigger,
        channel: 'sms',
        bodyTemplate: 'Test',
      });
      expect(result.trigger).toBe(trigger);
    }
  });
});

describe('Customer Notifications - Update Schema', () => {
  it('accepts partial update', () => {
    const result = updateNotificationTemplateSchema.parse({
      isActive: false,
    });
    expect(result.isActive).toBe(false);
    expect(result.trigger).toBeUndefined();
  });

  it('accepts empty update', () => {
    const result = updateNotificationTemplateSchema.parse({});
    expect(Object.keys(result)).toHaveLength(0);
  });
});
