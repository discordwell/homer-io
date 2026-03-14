import { describe, it, expect } from 'vitest';
import {
  registerSchema, loginSchema, refreshTokenSchema,
  paginationSchema, coordsSchema, addressSchema,
  createVehicleSchema, createDriverSchema,
  createOrderSchema, updateOrderStatusSchema,
} from '../index.js';
import { hasMinRole } from '../types/roles.js';

describe('Auth Schemas', () => {
  it('validates register input', () => {
    const valid = registerSchema.parse({
      email: 'test@homer.io',
      password: 'secureP@ss1',
      name: 'Test User',
      orgName: 'Test Org',
    });
    expect(valid.email).toBe('test@homer.io');
    expect(valid.orgName).toBe('Test Org');
  });

  it('rejects short password', () => {
    expect(() => registerSchema.parse({
      email: 'test@homer.io',
      password: 'short',
      name: 'Test',
      orgName: 'Org',
    })).toThrow();
  });

  it('rejects invalid email', () => {
    expect(() => registerSchema.parse({
      email: 'not-an-email',
      password: 'secureP@ss1',
      name: 'Test',
      orgName: 'Org',
    })).toThrow();
  });

  it('validates login input', () => {
    const valid = loginSchema.parse({
      email: 'test@homer.io',
      password: 'password123',
    });
    expect(valid.email).toBe('test@homer.io');
  });

  it('validates refresh token input', () => {
    const valid = refreshTokenSchema.parse({ refreshToken: 'abc123' });
    expect(valid.refreshToken).toBe('abc123');
  });
});

describe('Common Schemas', () => {
  it('validates pagination with defaults', () => {
    const result = paginationSchema.parse({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it('coerces string pagination values', () => {
    const result = paginationSchema.parse({ page: '3', limit: '50' });
    expect(result.page).toBe(3);
    expect(result.limit).toBe(50);
  });

  it('rejects limit > 100', () => {
    expect(() => paginationSchema.parse({ limit: 200 })).toThrow();
  });

  it('validates coordinates', () => {
    const valid = coordsSchema.parse({ lat: 37.4848, lng: -122.2281 });
    expect(valid.lat).toBe(37.4848);
  });

  it('rejects out-of-range coordinates', () => {
    expect(() => coordsSchema.parse({ lat: 91, lng: 0 })).toThrow();
    expect(() => coordsSchema.parse({ lat: 0, lng: 181 })).toThrow();
  });

  it('validates address', () => {
    const valid = addressSchema.parse({
      street: '123 Main St',
      city: 'San Mateo',
      state: 'CA',
      zip: '94401',
    });
    expect(valid.country).toBe('US'); // default
  });
});

describe('Fleet Schemas', () => {
  it('validates vehicle creation', () => {
    const valid = createVehicleSchema.parse({
      name: 'Van 1',
      type: 'van',
      capacityCount: 50,
    });
    expect(valid.fuelType).toBe('gasoline'); // default
  });

  it('rejects invalid vehicle type', () => {
    expect(() => createVehicleSchema.parse({
      name: 'X',
      type: 'helicopter',
    })).toThrow();
  });

  it('validates driver creation', () => {
    const valid = createDriverSchema.parse({
      name: 'John Doe',
      phone: '555-0100',
    });
    expect(valid.skillTags).toEqual([]); // default
  });
});

describe('Order Schemas', () => {
  it('validates order creation', () => {
    const valid = createOrderSchema.parse({
      recipientName: 'Jane Doe',
      deliveryAddress: {
        street: '456 Oak Ave',
        city: 'Redwood City',
        state: 'CA',
        zip: '94063',
      },
    });
    expect(valid.packageCount).toBe(1); // default
    expect(valid.priority).toBe('normal'); // default
  });

  it('validates order with time window', () => {
    const valid = createOrderSchema.parse({
      recipientName: 'Bob',
      deliveryAddress: {
        street: '789 Elm St',
        city: 'Burlingame',
        state: 'CA',
        zip: '94010',
      },
      timeWindow: {
        start: '2026-03-15T09:00:00Z',
        end: '2026-03-15T12:00:00Z',
      },
      priority: 'urgent',
      requiresSignature: true,
    });
    expect(valid.priority).toBe('urgent');
    expect(valid.requiresSignature).toBe(true);
  });

  it('validates status update', () => {
    const valid = updateOrderStatusSchema.parse({
      status: 'delivered',
    });
    expect(valid.status).toBe('delivered');
  });

  it('rejects invalid status', () => {
    expect(() => updateOrderStatusSchema.parse({
      status: 'invalid_status',
    })).toThrow();
  });
});

describe('Role Hierarchy', () => {
  it('owner has min role of all levels', () => {
    expect(hasMinRole('owner', 'owner')).toBe(true);
    expect(hasMinRole('owner', 'admin')).toBe(true);
    expect(hasMinRole('owner', 'dispatcher')).toBe(true);
    expect(hasMinRole('owner', 'driver')).toBe(true);
  });

  it('driver only has min role of driver', () => {
    expect(hasMinRole('driver', 'driver')).toBe(true);
    expect(hasMinRole('driver', 'dispatcher')).toBe(false);
    expect(hasMinRole('driver', 'admin')).toBe(false);
    expect(hasMinRole('driver', 'owner')).toBe(false);
  });

  it('dispatcher can access driver-level', () => {
    expect(hasMinRole('dispatcher', 'driver')).toBe(true);
    expect(hasMinRole('dispatcher', 'dispatcher')).toBe(true);
    expect(hasMinRole('dispatcher', 'admin')).toBe(false);
  });
});
