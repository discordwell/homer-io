import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Dependency version regression tests.
 *
 * These tests prevent accidental downgrades of security-sensitive packages
 * to versions with known CVEs. When a CVE patch ships in a new version,
 * bump the minimum assertion here so a future `npm install` that resolves
 * an older version breaks the build instead of silently regressing.
 *
 * Keep the assertions simple: minimum versions only. Upper bounds belong
 * in package.json, not here.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
// packages/api/src/__tests__/dependency-versions.test.ts -> ../../../../package-lock.json
const LOCKFILE_PATH = resolve(__dirname, '../../../../package-lock.json');

interface Lockfile {
  packages: Record<string, { version?: string }>;
}

function loadLockfile(): Lockfile {
  return JSON.parse(readFileSync(LOCKFILE_PATH, 'utf8')) as Lockfile;
}

function getVersion(lock: Lockfile, nodeModulesPath: string): string {
  const pkg = lock.packages[nodeModulesPath];
  if (!pkg?.version) {
    throw new Error(`Package not found at ${nodeModulesPath} in package-lock.json`);
  }
  return pkg.version;
}

/**
 * Compare two semver strings (major.minor.patch only — prerelease tags are
 * ignored). Returns positive if a > b, zero if equal, negative if a < b.
 */
function semverCompare(a: string, b: string): number {
  const parse = (v: string) => v.split('-')[0].split('.').map((n) => parseInt(n, 10));
  const [aMajor, aMinor, aPatch] = parse(a);
  const [bMajor, bMinor, bPatch] = parse(b);
  if (aMajor !== bMajor) return aMajor - bMajor;
  if (aMinor !== bMinor) return aMinor - bMinor;
  return aPatch - bPatch;
}

describe('dependency version floors (CVE regression guards)', () => {
  const lock = loadLockfile();

  it('fastify is >= 5.8.5 (patches GHSA-247c-9743-5963 body-schema bypass and GHSA-444r-cwp2-x5xf X-Forwarded spoofing)', () => {
    const version = getVersion(lock, 'node_modules/fastify');
    expect(semverCompare(version, '5.8.5')).toBeGreaterThanOrEqual(0);
  });

  it('vite (primary) is >= 8.0.5 (patches GHSA-4w7w-66w2-5vf9, GHSA-v2wj-q39q-566r, GHSA-p9ff-h696-f583)', () => {
    const version = getVersion(lock, 'node_modules/vite');
    expect(semverCompare(version, '8.0.5')).toBeGreaterThanOrEqual(0);
  });

  it('vite bundled inside vitest/vite-node is >= 7.3.2 (patches same path-traversal / fs.deny / WebSocket-read CVEs)', () => {
    // vitest ships its own vite under its tree; ensure it is also on a patched version
    for (const nm of ['node_modules/vite-node/node_modules/vite', 'node_modules/vitest/node_modules/vite']) {
      const pkg = lock.packages[nm];
      if (!pkg?.version) continue; // not present on all installs
      expect(semverCompare(pkg.version, '7.3.2')).toBeGreaterThanOrEqual(0);
    }
  });

  it('@fastify/static is >= 9.1.1 (patches GHSA-pr96-94w5-mx2h directory-listing traversal and GHSA-x428-ghpx-8j92 route-guard bypass)', () => {
    const version = getVersion(lock, 'node_modules/@fastify/static');
    expect(semverCompare(version, '9.1.1')).toBeGreaterThanOrEqual(0);
  });

  it('serialize-javascript is >= 7.0.5 (patches GHSA-5c6j-r48x-rmvq RCE and GHSA-qj8w-gfj5-8c6v DoS; forced via root package.json override)', () => {
    const version = getVersion(lock, 'node_modules/serialize-javascript');
    expect(semverCompare(version, '7.0.5')).toBeGreaterThanOrEqual(0);
  });

  it('@rollup/plugin-terser is >= 1.0.0 (transitive carrier of serialize-javascript; forced via override)', () => {
    const version = getVersion(lock, 'node_modules/@rollup/plugin-terser');
    expect(semverCompare(version, '1.0.0')).toBeGreaterThanOrEqual(0);
  });
});
