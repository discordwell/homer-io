import { describe, it, expect } from 'vitest';
import { createConnectionSchema, integrationPlatformEnum, platformInfoSchema } from '@homer-io/shared';

describe('Integration schemas', () => {
  it('validates create connection input', () => {
    const valid = createConnectionSchema.parse({
      platform: 'shopify',
      storeUrl: 'https://mystore.myshopify.com',
      credentials: { apiKey: 'abc', password: 'xyz' },
      autoImport: true,
    });
    expect(valid.platform).toBe('shopify');
    expect(valid.storeUrl).toBe('https://mystore.myshopify.com');
    expect(valid.credentials.apiKey).toBe('abc');
  });

  it('rejects invalid platform', () => {
    expect(() =>
      createConnectionSchema.parse({
        platform: 'amazon',
        storeUrl: 'https://amazon.com',
        credentials: {},
      }),
    ).toThrow();
  });

  it('rejects invalid store URL', () => {
    expect(() =>
      createConnectionSchema.parse({
        platform: 'shopify',
        storeUrl: 'not-a-url',
        credentials: {},
      }),
    ).toThrow();
  });

  it('validates platform enum', () => {
    expect(integrationPlatformEnum.parse('shopify')).toBe('shopify');
    expect(integrationPlatformEnum.parse('woocommerce')).toBe('woocommerce');
    expect(() => integrationPlatformEnum.parse('magento')).toThrow();
  });

  it('defaults autoImport to true', () => {
    const result = createConnectionSchema.parse({
      platform: 'woocommerce',
      storeUrl: 'https://store.example.com',
      credentials: { consumerKey: 'ck_test', consumerSecret: 'cs_test' },
    });
    expect(result.autoImport).toBe(true);
  });
});
