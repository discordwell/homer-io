import { describe, it, expect } from 'vitest';
import { createRouteTemplateSchema, orderTemplateItemSchema } from '@homer-io/shared';

describe('Route Templates - Schema Validation', () => {
  it('accepts a valid route template', () => {
    const result = createRouteTemplateSchema.parse({
      name: 'Morning Route',
      recurrenceRule: '0 6 * * 1-5',
      recurrenceTimezone: 'America/New_York',
      isActive: true,
      orderTemplate: [
        {
          recipientName: 'John Doe',
          deliveryAddress: { street: '123 Main St', city: 'NYC', state: 'NY', zip: '10001' },
          packageCount: 2,
          priority: 'normal',
        },
      ],
    });
    expect(result.name).toBe('Morning Route');
    expect(result.recurrenceRule).toBe('0 6 * * 1-5');
    expect(result.orderTemplate).toHaveLength(1);
    expect(result.isActive).toBe(true);
  });

  it('applies defaults for optional fields', () => {
    const result = createRouteTemplateSchema.parse({
      name: 'Test',
      recurrenceRule: '0 8 * * *',
    });
    expect(result.recurrenceTimezone).toBe('UTC');
    expect(result.isActive).toBe(true);
    expect(result.orderTemplate).toEqual([]);
  });

  it('rejects empty name', () => {
    expect(() => createRouteTemplateSchema.parse({
      name: '',
      recurrenceRule: '0 8 * * *',
    })).toThrow();
  });

  it('rejects empty recurrence rule', () => {
    expect(() => createRouteTemplateSchema.parse({
      name: 'Test',
      recurrenceRule: '',
    })).toThrow();
  });

  it('accepts optional depot coordinates', () => {
    const result = createRouteTemplateSchema.parse({
      name: 'Test',
      recurrenceRule: '0 8 * * *',
      depotLat: 40.7128,
      depotLng: -74.006,
    });
    expect(result.depotLat).toBe(40.7128);
    expect(result.depotLng).toBe(-74.006);
  });

  it('rejects latitude out of range', () => {
    expect(() => createRouteTemplateSchema.parse({
      name: 'Test',
      recurrenceRule: '0 8 * * *',
      depotLat: 91,
    })).toThrow();
  });

  it('rejects longitude out of range', () => {
    expect(() => createRouteTemplateSchema.parse({
      name: 'Test',
      recurrenceRule: '0 8 * * *',
      depotLng: 181,
    })).toThrow();
  });

  it('accepts optional driver and vehicle IDs', () => {
    const result = createRouteTemplateSchema.parse({
      name: 'Test',
      recurrenceRule: '0 8 * * *',
      driverId: '550e8400-e29b-41d4-a716-446655440000',
      vehicleId: '660e8400-e29b-41d4-a716-446655440001',
    });
    expect(result.driverId).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(result.vehicleId).toBe('660e8400-e29b-41d4-a716-446655440001');
  });

  it('rejects non-UUID driver ID', () => {
    expect(() => createRouteTemplateSchema.parse({
      name: 'Test',
      recurrenceRule: '0 8 * * *',
      driverId: 'not-a-uuid',
    })).toThrow();
  });

  it('supports partial update', () => {
    const partial = createRouteTemplateSchema.partial();
    const result = partial.parse({ name: 'Updated Name' });
    expect(result.name).toBe('Updated Name');
    expect(result.recurrenceRule).toBeUndefined();
  });
});

describe('Route Templates - Order Template Item Schema', () => {
  it('accepts a valid order template item', () => {
    const result = orderTemplateItemSchema.parse({
      recipientName: 'Jane Smith',
      deliveryAddress: { street: '456 Oak Ave', city: 'Brooklyn', state: 'NY', zip: '11201' },
      packageCount: 3,
      priority: 'high',
    });
    expect(result.recipientName).toBe('Jane Smith');
    expect(result.packageCount).toBe(3);
    expect(result.priority).toBe('high');
  });

  it('applies defaults for optional order template fields', () => {
    const result = orderTemplateItemSchema.parse({
      recipientName: 'Test',
      deliveryAddress: { street: '1 Main', city: 'X', state: 'Y', zip: '00000' },
    });
    expect(result.packageCount).toBe(1);
    expect(result.priority).toBe('normal');
    expect(result.requiresSignature).toBe(false);
    expect(result.requiresPhoto).toBe(false);
  });

  it('rejects empty recipient name', () => {
    expect(() => orderTemplateItemSchema.parse({
      recipientName: '',
      deliveryAddress: { street: '1 Main', city: 'X', state: 'Y', zip: '00000' },
    })).toThrow();
  });

  it('rejects invalid priority', () => {
    expect(() => orderTemplateItemSchema.parse({
      recipientName: 'Test',
      deliveryAddress: { street: '1 Main', city: 'X', state: 'Y', zip: '00000' },
      priority: 'critical',
    })).toThrow();
  });

  it('rejects zero package count', () => {
    expect(() => orderTemplateItemSchema.parse({
      recipientName: 'Test',
      deliveryAddress: { street: '1 Main', city: 'X', state: 'Y', zip: '00000' },
      packageCount: 0,
    })).toThrow();
  });
});
