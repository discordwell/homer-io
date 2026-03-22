import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateIndustryOrders, INDUSTRY_ORDER_TEMPLATES, pickIndustryItem } from '../modules/auth/industry-data.js';
import { BAY_AREA_LOCATIONS, generateDemoOrders } from '../modules/auth/demo-seed.js';

// Mock config for onboarding service import
vi.mock('../../config.js', () => ({
  config: {
    twilio: { accountSid: '', authToken: '', fromNumber: '' },
    sendgrid: { apiKey: '', fromEmail: 'noreply@homer.io' },
  },
}));

describe('Industry schemas', () => {
  it('industrySchema validates correct values', async () => {
    const { industrySchema } = await import('@homer-io/shared');
    expect(industrySchema.parse('courier')).toBe('courier');
    expect(industrySchema.parse('restaurant')).toBe('restaurant');
    expect(industrySchema.parse('florist')).toBe('florist');
    expect(industrySchema.parse('pharmacy')).toBe('pharmacy');
    expect(industrySchema.parse('cannabis')).toBe('cannabis');
    expect(industrySchema.parse('grocery')).toBe('grocery');
    expect(industrySchema.parse('furniture')).toBe('furniture');
    expect(industrySchema.parse('other')).toBe('other');
  });

  it('industrySchema rejects invalid values', async () => {
    const { industrySchema } = await import('@homer-io/shared');
    expect(() => industrySchema.parse('trucking')).toThrow();
    expect(() => industrySchema.parse('')).toThrow();
    expect(() => industrySchema.parse(123)).toThrow();
  });

  it('setIndustrySchema validates body', async () => {
    const { setIndustrySchema } = await import('@homer-io/shared');
    const result = setIndustrySchema.parse({ industry: 'florist' });
    expect(result.industry).toBe('florist');
    expect(() => setIndustrySchema.parse({ industry: 'invalid' })).toThrow();
    expect(() => setIndustrySchema.parse({})).toThrow();
  });

  it('updateOrgSettingsSchema accepts optional industry', async () => {
    const { updateOrgSettingsSchema } = await import('@homer-io/shared');
    const withIndustry = updateOrgSettingsSchema.parse({ industry: 'pharmacy' });
    expect(withIndustry.industry).toBe('pharmacy');

    const without = updateOrgSettingsSchema.parse({ timezone: 'UTC' });
    expect(without.industry).toBeUndefined();
  });
});

describe('Industry order templates', () => {
  it('has templates for all 8 industries', () => {
    const industries = ['courier', 'restaurant', 'florist', 'pharmacy', 'cannabis', 'grocery', 'furniture', 'other'] as const;
    for (const industry of industries) {
      const template = INDUSTRY_ORDER_TEMPLATES[industry];
      expect(template).toBeDefined();
      expect(template.items.length).toBeGreaterThan(0);
      expect(template.notes.length).toBeGreaterThan(0);
    }
  });

  it('pharmacy template requires signature', () => {
    expect(INDUSTRY_ORDER_TEMPLATES.pharmacy.requiresSignature).toBe(true);
  });

  it('cannabis template requires signature', () => {
    expect(INDUSTRY_ORDER_TEMPLATES.cannabis.requiresSignature).toBe(true);
  });

  it('furniture template has high service duration', () => {
    expect(INDUSTRY_ORDER_TEMPLATES.furniture.serviceDurationMinutes).toBeGreaterThanOrEqual(30);
  });

  it('restaurant template has high priority', () => {
    expect(INDUSTRY_ORDER_TEMPLATES.restaurant.priority).toBe('high');
  });

  it('other template matches courier', () => {
    expect(INDUSTRY_ORDER_TEMPLATES.other).toEqual(INDUSTRY_ORDER_TEMPLATES.courier);
  });
});

describe('generateIndustryOrders', () => {
  const locations = BAY_AREA_LOCATIONS.slice(0, 5);

  it('generates the requested number of orders', () => {
    const orders = generateIndustryOrders('courier', 10, locations);
    expect(orders).toHaveLength(10);
  });

  it('generates florist orders with structured gift messages', () => {
    // ~80% of florist orders are gifts with sender data
    const orders = generateIndustryOrders('florist', 50, locations);
    const gifts = orders.filter(o => o.isGift);
    expect(gifts.length).toBeGreaterThan(10);
    for (const gift of gifts) {
      expect(gift.senderName).toBeDefined();
      expect(gift.giftMessage).toBeDefined();
    }
  });

  it('generates pharmacy orders with signature required', () => {
    const orders = generateIndustryOrders('pharmacy', 10, locations);
    orders.forEach(o => {
      expect(o.requiresSignature).toBe(true);
    });
  });

  it('generates cannabis orders with compliance custom fields', () => {
    const orders = generateIndustryOrders('cannabis', 10, locations);
    orders.forEach(o => {
      expect(o.customFields.ageVerificationRequired).toBe(true);
      expect(o.customFields.complianceManifest).toBeDefined();
    });
  });

  it('generates furniture orders with weight', () => {
    const orders = generateIndustryOrders('furniture', 10, locations);
    orders.forEach(o => {
      expect(o.weight).not.toBeNull();
      expect(Number(o.weight)).toBeGreaterThanOrEqual(30);
    });
  });

  it('generates restaurant orders with high priority', () => {
    const orders = generateIndustryOrders('restaurant', 10, locations);
    orders.forEach(o => {
      expect(o.priority).toBe('high');
    });
  });

  it('all orders have valid address data', () => {
    const industries = ['courier', 'restaurant', 'florist', 'pharmacy', 'cannabis', 'grocery', 'furniture', 'other'] as const;
    for (const industry of industries) {
      const orders = generateIndustryOrders(industry, 5, locations);
      orders.forEach(o => {
        expect(o.recipientName).toBeDefined();
        expect(o.deliveryAddress.street).toBeDefined();
        expect(o.deliveryLat).toBeDefined();
        expect(o.deliveryLng).toBeDefined();
        expect(o.createdAt).toBeInstanceOf(Date);
      });
    }
  });
});

describe('pickIndustryItem', () => {
  it('returns a string for each industry', () => {
    const industries = ['courier', 'restaurant', 'florist', 'pharmacy', 'cannabis', 'grocery', 'furniture', 'other'] as const;
    for (const industry of industries) {
      const item = pickIndustryItem(industry);
      expect(typeof item).toBe('string');
      expect(item.length).toBeGreaterThan(0);
    }
  });
});

describe('generateDemoOrders with industry', () => {
  it('generates industry-flavored orders when industry is provided', () => {
    const orders = generateDemoOrders(undefined, 'pharmacy');
    expect(orders.length).toBeGreaterThanOrEqual(15);
    // Industry-flavored orders have the richer schema
    orders.forEach(o => {
      expect(o.recipientName).toBeDefined();
      expect(o.deliveryAddress).toBeDefined();
      expect('requiresSignature' in o).toBe(true);
    });
  });

  it('generates generic orders without industry (backward compat)', () => {
    const orders = generateDemoOrders();
    expect(orders.length).toBeGreaterThanOrEqual(15);
    orders.forEach(o => {
      expect(o.recipientName).toBeDefined();
      expect(o.deliveryAddress).toBeDefined();
    });
  });
});

describe('Onboarding service - industry step', () => {
  it('setIndustry and loadSampleData are exported', async () => {
    const mod = await import('../modules/onboarding/service.js');
    expect(mod.setIndustry).toBeDefined();
    expect(mod.loadSampleData).toBeDefined();
  });

  it('industry step is not skippable', async () => {
    const mod = await import('../modules/onboarding/service.js');
    const result = await mod.skipStep('tenant-123', 'industry');
    expect(result.success).toBe(false);
    expect(result.message).toContain('cannot be skipped');
  });
});
