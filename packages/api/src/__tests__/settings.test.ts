import { describe, it, expect } from 'vitest';
import { orgSettingsSchema, updateOrgSettingsSchema, brandingSchema } from '@homer-io/shared';

describe('Settings - Branding', () => {
  it('accepts valid branding', () => {
    const result = brandingSchema.parse({
      logoUrl: 'https://example.com/logo.png',
      primaryColor: '#5BA4F5',
      companyName: 'HOMER Logistics',
    });
    expect(result.primaryColor).toBe('#5BA4F5');
  });

  it('accepts empty branding', () => {
    const result = brandingSchema.parse({});
    expect(result.logoUrl).toBeUndefined();
    expect(result.primaryColor).toBeUndefined();
    expect(result.companyName).toBeUndefined();
  });

  it('rejects invalid color format', () => {
    expect(() => brandingSchema.parse({ primaryColor: 'blue' })).toThrow();
    expect(() => brandingSchema.parse({ primaryColor: '#FFF' })).toThrow();
    expect(() => brandingSchema.parse({ primaryColor: '#GGGGGG' })).toThrow();
  });

  it('rejects company name > 255 chars', () => {
    expect(() => brandingSchema.parse({
      companyName: 'x'.repeat(256),
    })).toThrow();
  });
});

describe('Settings - Org Settings', () => {
  it('validates complete settings', () => {
    const result = orgSettingsSchema.parse({
      timezone: 'America/Chicago',
      units: 'imperial',
      branding: { companyName: 'Test' },
      notificationPrefs: { deliveryUpdates: true },
    });
    expect(result.timezone).toBe('America/Chicago');
    expect(result.units).toBe('imperial');
  });

  it('rejects invalid units', () => {
    expect(() => orgSettingsSchema.parse({
      timezone: 'UTC',
      units: 'nautical',
      branding: {},
      notificationPrefs: {},
    })).toThrow();
  });

  it('requires all fields for full schema', () => {
    expect(() => orgSettingsSchema.parse({
      timezone: 'UTC',
    })).toThrow();
  });
});

describe('Settings - Partial Update', () => {
  it('accepts single field update', () => {
    const result = updateOrgSettingsSchema.parse({ timezone: 'Europe/Berlin' });
    expect(result.timezone).toBe('Europe/Berlin');
    expect(result.units).toBeUndefined();
  });

  it('accepts empty update', () => {
    const result = updateOrgSettingsSchema.parse({});
    expect(Object.keys(result).length).toBe(0);
  });

  it('accepts branding-only update', () => {
    const result = updateOrgSettingsSchema.parse({
      branding: { primaryColor: '#FF0000' },
    });
    expect(result.branding?.primaryColor).toBe('#FF0000');
  });
});
