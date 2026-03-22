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

describe('Feature definitions for new verticals', () => {
  it('has restaurant features', async () => {
    const { FEATURE_DEFINITIONS, INDUSTRY_DEFAULT_FEATURES } = await import('@homer-io/shared');
    const speedPriority = FEATURE_DEFINITIONS.find(f => f.key === 'speed_priority');
    expect(speedPriority).toBeDefined();
    expect(INDUSTRY_DEFAULT_FEATURES.restaurant).toContain('speed_priority');
  });

  it('has grocery features', async () => {
    const { FEATURE_DEFINITIONS, INDUSTRY_DEFAULT_FEATURES } = await import('@homer-io/shared');
    expect(FEATURE_DEFINITIONS.find(f => f.key === 'substitution_management')).toBeDefined();
    expect(FEATURE_DEFINITIONS.find(f => f.key === 'temperature_zones')).toBeDefined();
    expect(INDUSTRY_DEFAULT_FEATURES.grocery).toContain('substitution_management');
    expect(INDUSTRY_DEFAULT_FEATURES.grocery).toContain('temperature_zones');
    expect(INDUSTRY_DEFAULT_FEATURES.grocery).toContain('cold_chain');
  });

  it('has furniture features', async () => {
    const { FEATURE_DEFINITIONS, INDUSTRY_DEFAULT_FEATURES } = await import('@homer-io/shared');
    expect(FEATURE_DEFINITIONS.find(f => f.key === 'crew_assignment')).toBeDefined();
    expect(FEATURE_DEFINITIONS.find(f => f.key === 'assembly_tracking')).toBeDefined();
    expect(FEATURE_DEFINITIONS.find(f => f.key === 'haul_away')).toBeDefined();
    expect(FEATURE_DEFINITIONS.find(f => f.key === 'wide_time_windows')).toBeDefined();
    expect(INDUSTRY_DEFAULT_FEATURES.furniture).toContain('crew_assignment');
    expect(INDUSTRY_DEFAULT_FEATURES.furniture).toContain('assembly_tracking');
  });
});

describe('Order schema — new vertical fields', () => {
  it('accepts grocery fields', async () => {
    const { createOrderSchema } = await import('@homer-io/shared');
    const result = createOrderSchema.parse({
      recipientName: 'Test',
      deliveryAddress: { street: '123 Main', city: 'SF', state: 'CA', zip: '94102' },
      substitutionAllowed: false,
      substitutionNotes: 'No substitutions for dairy',
      temperatureZone: 'frozen',
    });
    expect(result.substitutionAllowed).toBe(false);
    expect(result.temperatureZone).toBe('frozen');
  });

  it('accepts furniture fields', async () => {
    const { createOrderSchema } = await import('@homer-io/shared');
    const result = createOrderSchema.parse({
      recipientName: 'Test',
      deliveryAddress: { street: '123 Main', city: 'SF', state: 'CA', zip: '94102' },
      crewSize: 2,
      assemblyRequired: true,
      haulAway: true,
    });
    expect(result.crewSize).toBe(2);
    expect(result.assemblyRequired).toBe(true);
    expect(result.haulAway).toBe(true);
  });

  it('grocery defaults', async () => {
    const { createOrderSchema } = await import('@homer-io/shared');
    const result = createOrderSchema.parse({
      recipientName: 'Test',
      deliveryAddress: { street: '123 Main', city: 'SF', state: 'CA', zip: '94102' },
    });
    expect(result.substitutionAllowed).toBe(true);
    expect(result.crewSize).toBe(1);
    expect(result.assemblyRequired).toBe(false);
    expect(result.haulAway).toBe(false);
  });

  it('rejects invalid temperature zone', async () => {
    const { createOrderSchema } = await import('@homer-io/shared');
    expect(() => createOrderSchema.parse({
      recipientName: 'Test',
      deliveryAddress: { street: '123 Main', city: 'SF', state: 'CA', zip: '94102' },
      temperatureZone: 'hot',
    })).toThrow();
  });

  it('rejects crew size > 4', async () => {
    const { createOrderSchema } = await import('@homer-io/shared');
    expect(() => createOrderSchema.parse({
      recipientName: 'Test',
      deliveryAddress: { street: '123 Main', city: 'SF', state: 'CA', zip: '94102' },
      crewSize: 5,
    })).toThrow();
  });
});

describe('DB schema — new vertical columns', () => {
  it('orders table has grocery columns', async () => {
    const { orders } = await import('../lib/db/schema/orders.js');
    expect(orders.substitutionAllowed).toBeDefined();
    expect(orders.substitutionNotes).toBeDefined();
    expect(orders.temperatureZone).toBeDefined();
  });

  it('orders table has furniture columns', async () => {
    const { orders } = await import('../lib/db/schema/orders.js');
    expect(orders.crewSize).toBeDefined();
    expect(orders.assemblyRequired).toBeDefined();
    expect(orders.haulAway).toBeDefined();
  });
});

describe('Restaurant demo data', () => {
  it('generates restaurant orders with high priority', async () => {
    const { generateIndustryOrders } = await import('../modules/auth/industry-data.js');
    const { BAY_AREA_LOCATIONS } = await import('../modules/auth/demo-seed.js');
    const orders = generateIndustryOrders('restaurant', 10, BAY_AREA_LOCATIONS.slice(0, 5));
    orders.forEach(o => expect(o.priority).toBe('high'));
  });
});

describe('Grocery demo data', () => {
  it('generates grocery orders with temperature zones', async () => {
    const { generateIndustryOrders } = await import('../modules/auth/industry-data.js');
    const { BAY_AREA_LOCATIONS } = await import('../modules/auth/demo-seed.js');
    const orders = generateIndustryOrders('grocery', 30, BAY_AREA_LOCATIONS.slice(0, 5));
    const withZones = orders.filter(o => o.temperatureZone);
    expect(withZones.length).toBe(30); // all
    const frozen = orders.filter(o => o.temperatureZone === 'frozen');
    expect(frozen.length).toBeGreaterThan(0);
  });
});

describe('Furniture demo data', () => {
  it('generates furniture orders with crew/assembly/haul-away', async () => {
    const { generateIndustryOrders } = await import('../modules/auth/industry-data.js');
    const { BAY_AREA_LOCATIONS } = await import('../modules/auth/demo-seed.js');
    const orders = generateIndustryOrders('furniture', 30, BAY_AREA_LOCATIONS.slice(0, 5));

    const twoPerson = orders.filter(o => o.crewSize === 2);
    expect(twoPerson.length).toBeGreaterThan(10); // ~70%

    const withAssembly = orders.filter(o => o.assemblyRequired);
    expect(withAssembly.length).toBeGreaterThan(5); // ~50%

    const withHaulAway = orders.filter(o => o.haulAway);
    expect(withHaulAway.length).toBeGreaterThan(0); // ~30%
  });
});

describe('Platform enums', () => {
  it('integrationPlatformEnum accepts square and toast', async () => {
    const { integrationPlatformEnum } = await import('@homer-io/shared');
    expect(integrationPlatformEnum.parse('square')).toBe('square');
    expect(integrationPlatformEnum.parse('toast')).toBe('toast');
  });
});
