import { describe, it, expect } from 'vitest';
import { checkoutRequestSchema, changePlanRequestSchema, planFeatures, subscriptionPlanEnum } from '@homer-io/shared';

describe('Billing schemas', () => {
  it('validates checkout request', () => {
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

  it('defaults interval to monthly', () => {
    const result = checkoutRequestSchema.parse({ plan: 'starter' });
    expect(result.interval).toBe('monthly');
  });

  it('validates change plan request', () => {
    const valid = changePlanRequestSchema.parse({
      plan: 'enterprise',
      interval: 'annual',
    });
    expect(valid.plan).toBe('enterprise');
    expect(valid.interval).toBe('annual');
  });

  it('has correct plan features structure', () => {
    expect(planFeatures.starter.price.monthly).toBe(4900);
    expect(planFeatures.starter.price.annual).toBe(3920);
    expect(planFeatures.growth.price.monthly).toBe(5900);
    expect(planFeatures.enterprise.price.monthly).toBe(6500);
    expect(planFeatures.starter.ordersPerDriver).toBe(500);
    expect(planFeatures.growth.ordersPerDriver).toBe(Infinity);
    expect(planFeatures.starter.integrations).toBe(false);
    expect(planFeatures.growth.integrations).toBe(true);
  });

  it('validates subscription plan enum', () => {
    expect(subscriptionPlanEnum.parse('starter')).toBe('starter');
    expect(subscriptionPlanEnum.parse('growth')).toBe('growth');
    expect(subscriptionPlanEnum.parse('enterprise')).toBe('enterprise');
    expect(() => subscriptionPlanEnum.parse('free')).toThrow();
  });
});
