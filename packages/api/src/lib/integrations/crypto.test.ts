import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── crypto layer key-length / no-fallback enforcement ──────────────────────
//
// The crypto layer SHA-256-derives a 32-byte AES-256-GCM key from a passphrase
// in INTEGRATION_ENCRYPTION_KEY. A missing passphrase must throw (no fallback
// to a hardcoded dev key). A too-short passphrase (<32 chars) must also throw
// at key initialization, not silently at encrypt/decrypt time.

describe('crypto.ts — key validation', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock('../../config.js');
  });

  const mockConfig = (encryptionKey: string, nodeEnv = 'test') => {
    vi.doMock('../../config.js', () => ({
      config: {
        nodeEnv,
        integrations: { encryptionKey },
      },
    }));
  };

  it('encrypt throws when encryption key is empty (no hardcoded fallback)', async () => {
    mockConfig('');
    const { encrypt } = await import('./crypto.js');
    expect(() => encrypt('data')).toThrow(/INTEGRATION_ENCRYPTION_KEY is required/);
  });

  it('decrypt throws when encryption key is empty (no hardcoded fallback)', async () => {
    mockConfig('');
    const { decrypt } = await import('./crypto.js');
    expect(() => decrypt('aWY=:dGFn:Y2lwaGVy')).toThrow(/INTEGRATION_ENCRYPTION_KEY is required/);
  });

  it('encrypt throws when encryption key is too short (<32 chars)', async () => {
    mockConfig('short-key'); // 9 chars
    const { encrypt } = await import('./crypto.js');
    expect(() => encrypt('data')).toThrow(/at least 32 characters/);
  });

  it('decrypt throws when encryption key is too short (<32 chars)', async () => {
    mockConfig('short-key');
    const { decrypt } = await import('./crypto.js');
    expect(() => decrypt('aWY=:dGFn:Y2lwaGVy')).toThrow(/at least 32 characters/);
  });

  it('encrypt throws when key is exactly 31 chars (boundary, too short)', async () => {
    mockConfig('a'.repeat(31));
    const { encrypt } = await import('./crypto.js');
    expect(() => encrypt('data')).toThrow(/at least 32 characters/);
  });

  it('encrypt succeeds when key is exactly 32 chars (boundary, accepted)', async () => {
    mockConfig('a'.repeat(32));
    const { encrypt, decrypt } = await import('./crypto.js');
    const ciphertext = encrypt('hello');
    expect(decrypt(ciphertext)).toBe('hello');
  });

  it('round-trip encrypt+decrypt works with a valid key', async () => {
    mockConfig('a-valid-test-key-with-plenty-of-entropy-chars');
    const { encrypt, decrypt } = await import('./crypto.js');
    const plaintext = JSON.stringify({ apiKey: 'abc', password: 'xyz' });
    const encrypted = encrypt(plaintext);
    // Format: base64(iv):base64(authTag):base64(ciphertext)
    expect(encrypted.split(':')).toHaveLength(3);
    expect(decrypt(encrypted)).toBe(plaintext);
  });

  it('explicit short key override still fails validation', async () => {
    mockConfig('a'.repeat(32)); // config is fine
    const { encrypt } = await import('./crypto.js');
    // But an override parameter that's too short must still be rejected.
    expect(() => encrypt('data', 'too-short')).toThrow(/at least 32 characters/);
  });

  it('explicit empty-string override falls back to config key, not to a hardcoded dev key', async () => {
    mockConfig('a'.repeat(32));
    const { encrypt, decrypt } = await import('./crypto.js');
    // Passing '' for override should behave like omitting it (use config key)
    // — it must NOT silently substitute a hardcoded dev fallback.
    const ciphertext = encrypt('data', '');
    expect(decrypt(ciphertext, '')).toBe('data');
  });

  it('MIN_ENCRYPTION_KEY_LENGTH is 32', async () => {
    mockConfig('a'.repeat(32));
    const { MIN_ENCRYPTION_KEY_LENGTH } = await import('./crypto.js');
    expect(MIN_ENCRYPTION_KEY_LENGTH).toBe(32);
  });
});

// ─── config.ts — startup enforcement of INTEGRATION_ENCRYPTION_KEY ──────────
//
// config.ts must throw at import time when INTEGRATION_ENCRYPTION_KEY is unset
// or too short, in ALL environments (dev/test/prod). This is the process-wide
// fail-fast boundary that prevents the encryption layer from ever operating
// with an invalid key.

describe('config.ts — INTEGRATION_ENCRYPTION_KEY required at startup', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('throws when INTEGRATION_ENCRYPTION_KEY is completely unset (production)', async () => {
    delete process.env.INTEGRATION_ENCRYPTION_KEY;
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'test-jwt-secret-for-config-load-test-only';

    await expect(import('../../config.js')).rejects.toThrow(/INTEGRATION_ENCRYPTION_KEY/);
  });

  it('throws when INTEGRATION_ENCRYPTION_KEY is completely unset (development)', async () => {
    // No more dev fallback — key is required in every environment.
    delete process.env.INTEGRATION_ENCRYPTION_KEY;
    process.env.NODE_ENV = 'development';

    await expect(import('../../config.js')).rejects.toThrow(/INTEGRATION_ENCRYPTION_KEY/);
  });

  it('throws when INTEGRATION_ENCRYPTION_KEY is empty string', async () => {
    process.env.INTEGRATION_ENCRYPTION_KEY = '';
    process.env.NODE_ENV = 'development';

    await expect(import('../../config.js')).rejects.toThrow(/INTEGRATION_ENCRYPTION_KEY/);
  });

  it('throws when INTEGRATION_ENCRYPTION_KEY is too short', async () => {
    process.env.INTEGRATION_ENCRYPTION_KEY = 'short';
    process.env.NODE_ENV = 'development';

    await expect(import('../../config.js')).rejects.toThrow(/at least 32 characters/);
  });

  it('loads successfully when INTEGRATION_ENCRYPTION_KEY is valid', async () => {
    process.env.INTEGRATION_ENCRYPTION_KEY = 'a-valid-test-key-with-plenty-of-entropy-chars';
    process.env.NODE_ENV = 'development';

    const { config } = await import('../../config.js');
    expect(config.integrations.encryptionKey).toBe(
      'a-valid-test-key-with-plenty-of-entropy-chars',
    );
  });
});
