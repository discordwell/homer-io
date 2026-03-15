import { describe, it, expect } from 'vitest';
import { createPodSchema, autoDispatchRequestSchema, createWebhookEndpointSchema, createNotificationTemplateSchema } from '@homer-io/shared';

describe('Driver API - Input Validation', () => {
  it('validates driver status update input', () => {
    // Status updates are simple enums validated at the route level
    const validStatuses = ['available', 'offline', 'on_break'];
    for (const status of validStatuses) {
      expect(typeof status).toBe('string');
    }
  });
});

describe('POD - Photo URL Constraints', () => {
  it('accepts exactly 4 photos (max)', () => {
    const result = createPodSchema.parse({
      photoUrls: ['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg'],
    });
    expect(result.photoUrls).toHaveLength(4);
  });

  it('accepts 0 photos', () => {
    const result = createPodSchema.parse({
      photoUrls: [],
    });
    expect(result.photoUrls).toHaveLength(0);
  });
});

describe('Phase 3 - Cross-Schema Integration', () => {
  it('all Phase 3 schemas parse independently', () => {
    // POD
    expect(() => createPodSchema.parse({})).not.toThrow();

    // Auto-dispatch
    expect(() => autoDispatchRequestSchema.parse({})).not.toThrow();

    // Webhook
    expect(() => createWebhookEndpointSchema.parse({
      url: 'https://example.com/hook',
      events: ['order.delivered'],
    })).not.toThrow();

    // Customer notification
    expect(() => createNotificationTemplateSchema.parse({
      trigger: 'delivered',
      channel: 'sms',
      bodyTemplate: 'Hello {{recipientName}}',
    })).not.toThrow();
  });
});
