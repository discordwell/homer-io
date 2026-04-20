// Vitest setup: runs before any test file is loaded.
//
// The real `src/config.ts` hard-requires JWT_SECRET at import time (by
// design — see the comment there). Tests that import the real config module
// (directly or transitively) would otherwise crash during collection. Set a
// deterministic test-only value here so test runs don't need operators to
// export JWT_SECRET manually. This is never read in production because
// production cannot load the vitest config.
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test-only-jwt-secret-do-not-use-in-prod';
}
