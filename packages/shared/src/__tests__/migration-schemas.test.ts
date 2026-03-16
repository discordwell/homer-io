import { describe, it, expect } from 'vitest';
import {
  createOrderSchema,
  orderTypeEnum,
  createDriverSchema,
  createVehicleSchema,
  csvImportRowSchema,
  resolveCsvAliases,
  createMigrationJobSchema,
  migrationJobResponseSchema,
  migrationPlatformEnum,
  migrationProgressSchema,
} from '../index.js';

describe('Order schema — migration fields', () => {
  it('accepts order with all new fields', () => {
    const result = createOrderSchema.parse({
      recipientName: 'Jane Doe',
      deliveryAddress: { street: '123 Main St', city: 'NYC', state: 'NY', zip: '10001' },
      serviceDurationMinutes: 15,
      orderType: 'pickup',
      barcodes: ['ABC123', 'DEF456'],
      customFields: { color: 'red', fragile: true, weight: 2.5 },
    });
    expect(result.serviceDurationMinutes).toBe(15);
    expect(result.orderType).toBe('pickup');
    expect(result.barcodes).toEqual(['ABC123', 'DEF456']);
    expect(result.customFields).toEqual({ color: 'red', fragile: true, weight: 2.5 });
  });

  it('defaults new fields when omitted', () => {
    const result = createOrderSchema.parse({
      recipientName: 'Jane Doe',
      deliveryAddress: { street: '123 Main St', city: 'NYC', state: 'NY', zip: '10001' },
    });
    expect(result.serviceDurationMinutes).toBeUndefined();
    expect(result.orderType).toBe('delivery');
    expect(result.barcodes).toEqual([]);
    expect(result.customFields).toEqual({});
  });

  it('rejects serviceDurationMinutes out of range', () => {
    expect(() => createOrderSchema.parse({
      recipientName: 'Jane',
      deliveryAddress: { street: '1', city: 'A', state: 'B', zip: '0' },
      serviceDurationMinutes: 0,
    })).toThrow();
    expect(() => createOrderSchema.parse({
      recipientName: 'Jane',
      deliveryAddress: { street: '1', city: 'A', state: 'B', zip: '0' },
      serviceDurationMinutes: 481,
    })).toThrow();
  });

  it('rejects invalid orderType', () => {
    expect(() => orderTypeEnum.parse('return')).toThrow();
  });

  it('rejects barcodes array exceeding max length', () => {
    expect(() => createOrderSchema.parse({
      recipientName: 'Jane',
      deliveryAddress: { street: '1', city: 'A', state: 'B', zip: '0' },
      barcodes: Array(51).fill('X'),
    })).toThrow();
  });
});

describe('Fleet schemas — externalId', () => {
  it('accepts driver with externalId', () => {
    const result = createDriverSchema.parse({
      name: 'John Doe',
      externalId: 'tookan_fleet_123',
    });
    expect(result.externalId).toBe('tookan_fleet_123');
  });

  it('accepts vehicle with externalId', () => {
    const result = createVehicleSchema.parse({
      name: 'Van 1',
      type: 'van',
      externalId: 'onfleet_veh_456',
    });
    expect(result.externalId).toBe('onfleet_veh_456');
  });

  it('defaults externalId to undefined when omitted', () => {
    const driver = createDriverSchema.parse({ name: 'Jane' });
    expect(driver.externalId).toBeUndefined();
    const vehicle = createVehicleSchema.parse({ name: 'Car 1', type: 'car' });
    expect(vehicle.externalId).toBeUndefined();
  });
});

describe('CSV import — competitor column aliases', () => {
  it('resolves service duration aliases', () => {
    expect(resolveCsvAliases({ service_duration: '10' }).serviceDurationMinutes).toBe(10);
    expect(resolveCsvAliases({ duration: '15' }).serviceDurationMinutes).toBe(15);
    expect(resolveCsvAliases({ stop_duration: '20' }).serviceDurationMinutes).toBe(20);
    expect(resolveCsvAliases({ job_time: '5' }).serviceDurationMinutes).toBe(5);
    expect(resolveCsvAliases({ serviceTime: '8' }).serviceDurationMinutes).toBe(8);
  });

  it('resolves barcode aliases', () => {
    expect(resolveCsvAliases({ barcode: 'BC123' }).barcodes).toEqual(['BC123']);
    expect(resolveCsvAliases({ tracking_number: 'TN456' }).barcodes).toEqual(['TN456']);
    expect(resolveCsvAliases({}).barcodes).toEqual([]);
  });

  it('resolves order type aliases', () => {
    expect(resolveCsvAliases({ order_type: 'pickup' }).orderType).toBe('pickup');
    expect(resolveCsvAliases({ type: 'delivery' }).orderType).toBe('delivery');
    expect(resolveCsvAliases({ task_type: 'pickup_and_delivery' }).orderType).toBe('pickup_and_delivery');
    expect(resolveCsvAliases({ type: 'invalid' }).orderType).toBeUndefined();
  });

  it('resolves time window aliases', () => {
    expect(resolveCsvAliases({ time_window_start: '09:00' }).timeWindowStart).toBe('09:00');
    expect(resolveCsvAliases({ delivery_after: '10:00' }).timeWindowStart).toBe('10:00');
    expect(resolveCsvAliases({ earliest: '08:00' }).timeWindowStart).toBe('08:00');
    expect(resolveCsvAliases({ twFrom: '07:00' }).timeWindowStart).toBe('07:00');
    expect(resolveCsvAliases({ time_window_end: '17:00' }).timeWindowEnd).toBe('17:00');
    expect(resolveCsvAliases({ delivery_before: '18:00' }).timeWindowEnd).toBe('18:00');
    expect(resolveCsvAliases({ latest: '19:00' }).timeWindowEnd).toBe('19:00');
    expect(resolveCsvAliases({ twTo: '20:00' }).timeWindowEnd).toBe('20:00');
  });

  it('resolves weight/volume aliases', () => {
    expect(resolveCsvAliases({ weight: '5.5' }).weight).toBe(5.5);
    expect(resolveCsvAliases({ kg: '3.2' }).weight).toBe(3.2);
    expect(resolveCsvAliases({ lbs: '10' }).weight).toBe(10);
    expect(resolveCsvAliases({ volume: '1.5' }).volume).toBe(1.5);
    expect(resolveCsvAliases({ cbm: '0.8' }).volume).toBe(0.8);
  });

  it('resolves external ID aliases', () => {
    expect(resolveCsvAliases({ external_id: 'EXT1' }).externalId).toBe('EXT1');
    expect(resolveCsvAliases({ order_id: 'ORD1' }).externalId).toBe('ORD1');
    expect(resolveCsvAliases({ job_id: 'JOB1' }).externalId).toBe('JOB1');
    expect(resolveCsvAliases({ task_id: 'TSK1' }).externalId).toBe('TSK1');
    expect(resolveCsvAliases({ orderNo: 'ON1' }).externalId).toBe('ON1');
  });

  it('resolves coordinate aliases', () => {
    expect(resolveCsvAliases({ latitude: '37.7749' }).latitude).toBe(37.7749);
    expect(resolveCsvAliases({ lat: '40.7128' }).latitude).toBe(40.7128);
    expect(resolveCsvAliases({ longitude: '-122.4194' }).longitude).toBe(-122.4194);
    expect(resolveCsvAliases({ lng: '-74.0060' }).longitude).toBe(-74.006);
    expect(resolveCsvAliases({ lon: '-73.9857' }).longitude).toBe(-73.9857);
  });

  it('accepts expanded CSV rows', () => {
    const result = csvImportRowSchema.parse({
      name: 'Test Customer',
      address: '123 Main St',
      service_duration: '10',
      barcode: 'BC123',
      order_type: 'delivery',
      lat: '37.7749',
      lng: '-122.4194',
      external_id: 'EXT001',
    });
    expect(result.name).toBe('Test Customer');
    expect(result.service_duration).toBe('10');
    expect(result.barcode).toBe('BC123');
  });
});

describe('Migration schemas', () => {
  it('validates migration platforms', () => {
    for (const p of ['tookan', 'onfleet', 'optimoroute', 'speedyroute', 'getswift', 'circuit']) {
      expect(migrationPlatformEnum.parse(p)).toBe(p);
    }
  });

  it('rejects invalid platform', () => {
    expect(() => migrationPlatformEnum.parse('doordash')).toThrow();
  });

  it('validates create migration job', () => {
    const result = createMigrationJobSchema.parse({
      sourcePlatform: 'tookan',
      config: {
        apiKey: 'abc123',
        importOrders: true,
        importDrivers: true,
      },
    });
    expect(result.sourcePlatform).toBe('tookan');
    expect(result.config.importVehicles).toBe(false); // default
  });

  it('validates migration progress with defaults', () => {
    const result = migrationProgressSchema.parse({});
    expect(result.orders.total).toBe(0);
    expect(result.drivers.imported).toBe(0);
    expect(result.vehicles.failed).toBe(0);
  });

  it('validates full migration job response', () => {
    const result = migrationJobResponseSchema.parse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      tenantId: '660e8400-e29b-41d4-a716-446655440000',
      sourcePlatform: 'onfleet',
      status: 'in_progress',
      config: { importOrders: true, importDrivers: false },
      progress: {
        orders: { total: 100, imported: 50, failed: 2 },
      },
      startedAt: '2026-03-16T10:00:00Z',
      completedAt: null,
      errorLog: [
        { entity: 'order', externalId: 'ext1', error: 'Invalid address', timestamp: '2026-03-16T10:01:00Z' },
      ],
      createdAt: '2026-03-16T09:00:00Z',
      updatedAt: '2026-03-16T10:01:00Z',
    });
    expect(result.status).toBe('in_progress');
    expect(result.progress.orders.imported).toBe(50);
    expect(result.errorLog).toHaveLength(1);
  });
});
