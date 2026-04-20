// Global test env setup: runs before any test file is loaded.
//
// The real `src/config.ts` hard-requires secrets (JWT_SECRET,
// INTEGRATION_ENCRYPTION_KEY) at import time by design. Tests that import
// the real config module (directly or transitively) would otherwise crash
// during collection. Seed deterministic test-only values here so test runs
// don't need operators to export these vars manually. These are fake,
// test-only values — they are never used outside vitest (production cannot
// load vitest config).

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test-only-jwt-secret-min-32-chars-do-not-use-in-prod';
}

if (!process.env.INTEGRATION_ENCRYPTION_KEY) {
  process.env.INTEGRATION_ENCRYPTION_KEY =
    'test-only-integration-encryption-key-min-32chars';
}
