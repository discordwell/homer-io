import { describe, it, expect } from 'vitest';
import { locationUpdateSchema, deliveryEventSchema, routeStatusTransitionSchema } from '@homer-io/shared';

describe('Tracking - Location Update Validation', () => {
  it('accepts valid location with all fields', () => {
    const result = locationUpdateSchema.parse({
      lat: 37.7749, lng: -122.4194,
      speed: 65.5, heading: 270, accuracy: 5.2,
    });
    expect(result.lat).toBe(37.7749);
    expect(result.lng).toBe(-122.4194);
    expect(result.speed).toBe(65.5);
    expect(result.heading).toBe(270);
    expect(result.accuracy).toBe(5.2);
  });

  it('accepts location with only required fields', () => {
    const result = locationUpdateSchema.parse({ lat: 0, lng: 0 });
    expect(result.speed).toBeUndefined();
    expect(result.heading).toBeUndefined();
    expect(result.accuracy).toBeUndefined();
  });

  it('rejects negative speed', () => {
    expect(() => locationUpdateSchema.parse({
      lat: 37, lng: -122, speed: -5,
    })).toThrow();
  });

  it('rejects heading > 360', () => {
    expect(() => locationUpdateSchema.parse({
      lat: 37, lng: -122, heading: 361,
    })).toThrow();
  });

  it('rejects non-integer heading', () => {
    expect(() => locationUpdateSchema.parse({
      lat: 37, lng: -122, heading: 180.5,
    })).toThrow();
  });
});

describe('Tracking - Delivery Event Validation', () => {
  const validEvent = {
    routeId: '550e8400-e29b-41d4-a716-446655440000',
    orderId: '660e8400-e29b-41d4-a716-446655440000',
    status: 'delivered' as const,
  };

  it('accepts valid delivered event', () => {
    const result = deliveryEventSchema.parse(validEvent);
    expect(result.status).toBe('delivered');
    expect(result.failureReason).toBeUndefined();
  });

  it('accepts failed event with reason', () => {
    const result = deliveryEventSchema.parse({
      ...validEvent,
      status: 'failed',
      failureReason: 'Customer not home',
    });
    expect(result.status).toBe('failed');
    expect(result.failureReason).toBe('Customer not home');
  });

  it('rejects non-UUID route/order IDs', () => {
    expect(() => deliveryEventSchema.parse({
      routeId: 'not-a-uuid',
      orderId: validEvent.orderId,
      status: 'delivered',
    })).toThrow();
  });

  it('rejects failure reason > 500 chars', () => {
    expect(() => deliveryEventSchema.parse({
      ...validEvent,
      status: 'failed',
      failureReason: 'x'.repeat(501),
    })).toThrow();
  });
});

describe('Tracking - Route Status Transition', () => {
  it('accepts all valid transition statuses', () => {
    for (const status of ['planned', 'in_progress', 'completed', 'cancelled'] as const) {
      const result = routeStatusTransitionSchema.parse({ status });
      expect(result.status).toBe(status);
    }
  });

  it('rejects draft as a transition target', () => {
    expect(() => routeStatusTransitionSchema.parse({ status: 'draft' })).toThrow();
  });

  it('rejects empty object', () => {
    expect(() => routeStatusTransitionSchema.parse({})).toThrow();
  });
});
