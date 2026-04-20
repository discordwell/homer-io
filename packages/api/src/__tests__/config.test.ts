import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Regression tests for the JWT_SECRET startup check. Previously, config.ts
// used a hardcoded fallback secret whenever NODE_ENV !== 'production', which
// meant any environment with NODE_ENV unset or set to 'staging'/'prod'/''
// silently signed JWTs with a publicly-known key. These tests lock in the
// always-required behaviour.

describe('config.ts — JWT_SECRET enforcement', () => {
  const originalJwtSecret = process.env.JWT_SECRET;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    // Restore env so other tests in the suite keep working.
    if (originalJwtSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalJwtSecret;
    }
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
    vi.resetModules();
  });

  async function importConfigFresh(): Promise<unknown> {
    vi.resetModules();
    // Dynamic import returns a fresh evaluation because vi.resetModules()
    // cleared the module cache.
    return import('../config.js');
  }

  it('throws when JWT_SECRET is missing (NODE_ENV=production)', async () => {
    delete process.env.JWT_SECRET;
    process.env.NODE_ENV = 'production';

    await expect(importConfigFresh()).rejects.toThrow(
      /Missing required env var JWT_SECRET/,
    );
  });

  it('throws when JWT_SECRET is missing (NODE_ENV=development)', async () => {
    delete process.env.JWT_SECRET;
    process.env.NODE_ENV = 'development';

    await expect(importConfigFresh()).rejects.toThrow(
      /Missing required env var JWT_SECRET/,
    );
  });

  it('throws when JWT_SECRET is missing and NODE_ENV is unset', async () => {
    delete process.env.JWT_SECRET;
    delete process.env.NODE_ENV;

    await expect(importConfigFresh()).rejects.toThrow(
      /Missing required env var JWT_SECRET/,
    );
  });

  it('throws for non-production NODE_ENV typos (prod, staging, prd, empty)', async () => {
    // The old bug: NODE_ENV='prod' / 'staging' / 'prd' / '' bypassed the
    // production check and silently used the hardcoded fallback. Verify we
    // now fail hard for every one of those values.
    for (const envValue of ['prod', 'staging', 'prd', '']) {
      delete process.env.JWT_SECRET;
      process.env.NODE_ENV = envValue;

      await expect(importConfigFresh()).rejects.toThrow(
        /Missing required env var JWT_SECRET/,
      );
    }
  });

  it('loads successfully when JWT_SECRET is set', async () => {
    process.env.JWT_SECRET = 'a-real-test-secret-value';
    process.env.NODE_ENV = 'development';

    const mod = (await importConfigFresh()) as {
      config: { jwt: { secret: string } };
    };
    expect(mod.config.jwt.secret).toBe('a-real-test-secret-value');
  });
});
