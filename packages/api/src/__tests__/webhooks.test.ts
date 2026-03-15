import { describe, it, expect } from 'vitest';
import { createWebhookEndpointSchema, updateWebhookEndpointSchema } from '@homer-io/shared';

describe('Webhooks - Endpoint Schema Validation', () => {
  it('accepts valid HTTPS endpoint', () => {
    const result = createWebhookEndpointSchema.parse({
      url: 'https://example.com/webhook',
      events: ['order.delivered'],
      description: 'My webhook',
    });
    expect(result.url).toBe('https://example.com/webhook');
    expect(result.events).toEqual(['order.delivered']);
  });

  it('rejects HTTP URL', () => {
    expect(() => createWebhookEndpointSchema.parse({
      url: 'http://example.com/webhook',
      events: ['order.delivered'],
    })).toThrow();
  });

  it('rejects invalid URL', () => {
    expect(() => createWebhookEndpointSchema.parse({
      url: 'not-a-url',
      events: ['order.delivered'],
    })).toThrow();
  });

  it('rejects empty events array', () => {
    expect(() => createWebhookEndpointSchema.parse({
      url: 'https://example.com/webhook',
      events: [],
    })).toThrow();
  });

  it('accepts multiple events', () => {
    const result = createWebhookEndpointSchema.parse({
      url: 'https://example.com/webhook',
      events: ['order.created', 'order.delivered', 'route.completed'],
    });
    expect(result.events).toHaveLength(3);
  });

  it('accepts wildcard events', () => {
    const result = createWebhookEndpointSchema.parse({
      url: 'https://example.com/webhook',
      events: ['order.*', 'route.*'],
    });
    expect(result.events).toEqual(['order.*', 'route.*']);
  });
});

describe('Webhooks - Update Schema', () => {
  it('accepts partial update with isActive', () => {
    const result = updateWebhookEndpointSchema.parse({
      isActive: false,
    });
    expect(result.isActive).toBe(false);
  });

  it('accepts URL-only update', () => {
    const result = updateWebhookEndpointSchema.parse({
      url: 'https://new-url.com/webhook',
    });
    expect(result.url).toBe('https://new-url.com/webhook');
  });

  it('rejects HTTP URL in update', () => {
    expect(() => updateWebhookEndpointSchema.parse({
      url: 'http://example.com/webhook',
    })).toThrow();
  });
});

describe('Webhooks - Event Matching', () => {
  // Test the wildcard matching logic used in the webhook helper
  function matchEvent(pattern: string, event: string): boolean {
    if (pattern === event) return true;
    if (pattern.endsWith('.*')) {
      const prefix = pattern.slice(0, -2);
      return event.startsWith(prefix + '.');
    }
    return false;
  }

  it('matches exact event', () => {
    expect(matchEvent('order.delivered', 'order.delivered')).toBe(true);
  });

  it('does not match different event', () => {
    expect(matchEvent('order.delivered', 'order.created')).toBe(false);
  });

  it('matches wildcard', () => {
    expect(matchEvent('order.*', 'order.delivered')).toBe(true);
    expect(matchEvent('order.*', 'order.created')).toBe(true);
  });

  it('does not match wrong prefix with wildcard', () => {
    expect(matchEvent('order.*', 'route.started')).toBe(false);
  });

  it('matches delivery wildcard', () => {
    expect(matchEvent('delivery.*', 'delivery.completed')).toBe(true);
    expect(matchEvent('delivery.*', 'delivery.failed')).toBe(true);
  });
});
