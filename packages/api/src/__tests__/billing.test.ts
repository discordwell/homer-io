import { describe, it, expect } from 'vitest';
import { checkoutRequestSchema, changePlanRequestSchema, planFeatures, subscriptionPlanEnum, meteredQuotas, meteredRates, payAsYouGoRequestSchema } from '@homer-io/shared';

describe('Billing schemas — per-order model', () => {
  it('validates checkout request with new plans', () => {
    const valid = checkoutRequestSchema.parse({
      plan: 'growth',
      interval: 'monthly',
    });
    expect(valid.plan).toBe('growth');
    expect(valid.interval).toBe('monthly');
  });

  it('rejects invalid plan', () => {
    expect(() =>
      checkoutRequestSchema.parse({ plan: 'mega', interval: 'monthly' }),
    ).toThrow();
  });

  it('rejects old plan names', () => {
    expect(() =>
      checkoutRequestSchema.parse({ plan: 'starter', interval: 'monthly' }),
    ).toThrow();
  });

  it('defaults interval to monthly', () => {
    const result = checkoutRequestSchema.parse({ plan: 'standard' });
    expect(result.interval).toBe('monthly');
  });

  it('validates change plan request', () => {
    const valid = changePlanRequestSchema.parse({
      plan: 'scale',
      interval: 'annual',
    });
    expect(valid.plan).toBe('scale');
    expect(valid.interval).toBe('annual');
  });

  it('validates subscription plan enum — new tiers', () => {
    expect(subscriptionPlanEnum.parse('free')).toBe('free');
    expect(subscriptionPlanEnum.parse('standard')).toBe('standard');
    expect(subscriptionPlanEnum.parse('growth')).toBe('growth');
    expect(subscriptionPlanEnum.parse('scale')).toBe('scale');
    expect(subscriptionPlanEnum.parse('enterprise')).toBe('enterprise');
    expect(() => subscriptionPlanEnum.parse('starter')).toThrow();
  });

  it('has correct plan features structure — per-order model', () => {
    // Free tier
    expect(planFeatures.free.price.monthly).toBe(0);
    expect(planFeatures.free.price.annual).toBe(0);
    expect(planFeatures.free.ordersPerMonth).toBe(100);

    // Standard tier
    expect(planFeatures.standard.price.monthly).toBe(14900);
    expect(planFeatures.standard.price.annual).toBe(11920);
    expect(planFeatures.standard.ordersPerMonth).toBe(1_000);

    // Growth tier
    expect(planFeatures.growth.price.monthly).toBe(34900);
    expect(planFeatures.growth.price.annual).toBe(27920);
    expect(planFeatures.growth.ordersPerMonth).toBe(5_000);

    // Scale tier
    expect(planFeatures.scale.price.monthly).toBe(69900);
    expect(planFeatures.scale.price.annual).toBe(55920);
    expect(planFeatures.scale.ordersPerMonth).toBe(15_000);

    // Enterprise tier
    expect(planFeatures.enterprise.ordersPerMonth).toBe(Infinity);
  });

  it('has metered quotas defined', () => {
    expect(meteredQuotas.aiOptimizations).toBe(10);
    expect(meteredQuotas.aiDispatches).toBe(5);
    expect(meteredQuotas.aiChatMessages).toBe(50);
    expect(meteredQuotas.smsSent).toBe(50);
    expect(meteredQuotas.emailsSent).toBe(500);
    expect(meteredQuotas.podStorageMb).toBe(1024);
  });

  it('has metered rates defined', () => {
    expect(meteredRates.aiOptimizations).toBe(5);
    expect(meteredRates.aiDispatches).toBe(15);
    expect(meteredRates.aiChatMessages).toBe(2);
    expect(meteredRates.smsSent).toBe(1);
    expect(meteredRates.emailsSent).toBe(0);
    expect(meteredRates.podStorageMb).toBe(10);
  });

  it('validates pay-as-you-go request', () => {
    const valid = payAsYouGoRequestSchema.parse({ enabled: true });
    expect(valid.enabled).toBe(true);

    const disabled = payAsYouGoRequestSchema.parse({ enabled: false });
    expect(disabled.enabled).toBe(false);
  });

  it('all plans have unlimited drivers (no per-driver fields)', () => {
    for (const plan of Object.values(planFeatures)) {
      // No ordersPerDriver field — replaced by ordersPerMonth
      expect(plan).toHaveProperty('ordersPerMonth');
      expect(plan).not.toHaveProperty('ordersPerDriver');
    }
  });

  it('all plans include features list', () => {
    for (const plan of Object.values(planFeatures)) {
      expect(plan.features.length).toBeGreaterThan(0);
      // Every plan should mention unlimited drivers
      const hasDriverMention = plan.features.some(f => f.toLowerCase().includes('driver'));
      expect(hasDriverMention).toBe(true);
    }
  });
});
