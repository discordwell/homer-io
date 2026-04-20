/**
 * Infra invariants — guards Findings H14 / H15 / H16 / H17.
 *
 * These tests read repo-root files (turbo.json, per-package package.json,
 * the deploy workflow, ecosystem/Caddy/.env.example) and assert the
 * operational invariants that can silently regress and break deploys.
 *
 * If any of these fail, a previous fix has been undone.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(__dirname, '../../../..');

function readJSON<T = unknown>(rel: string): T {
  return JSON.parse(readFileSync(resolve(repoRoot, rel), 'utf8')) as T;
}
function readText(rel: string): string {
  return readFileSync(resolve(repoRoot, rel), 'utf8');
}

interface PkgJson {
  name?: string;
  scripts?: Record<string, string>;
  devDependencies?: Record<string, string>;
  dependencies?: Record<string, string>;
}
interface TurboJson {
  tasks: Record<string, { inputs?: string[]; dependsOn?: string[]; outputs?: string[]; cache?: boolean }>;
}

describe('Finding H14: infra port consistency', () => {
  it('infra/ecosystem.config.cjs, Caddyfile, and .env.example all agree on API port', () => {
    const ecosystem = readText('infra/ecosystem.config.cjs');
    const caddy = readText('infra/Caddyfile');
    const envExample = readText('.env.example');

    const ecosystemPort = Number(/PORT:\s*(\d+)/.exec(ecosystem)?.[1]);
    const apiBlock = /api\.homer\.io\s*\{[^}]*\}/s.exec(caddy)?.[0] ?? '';
    const caddyPort = Number(/reverse_proxy\s+localhost:(\d+)/.exec(apiBlock)?.[1]);
    const envPort = Number(/^PORT=(\d+)/m.exec(envExample)?.[1]);

    expect(ecosystemPort).toBeGreaterThan(0);
    expect(caddyPort).toBeGreaterThan(0);
    expect(envPort).toBeGreaterThan(0);
    expect(ecosystemPort).toBe(caddyPort);
    expect(ecosystemPort).toBe(envPort);
  });
});

describe('Finding H15: mobile test script does not invoke jest (jest not installed)', () => {
  it('packages/mobile scripts.test does not call jest directly', () => {
    const pkg = readJSON<PkgJson>('packages/mobile/package.json');
    const testScript = pkg.scripts?.test ?? '';
    // Jest is not a dep. Either stub out or install jest+jest-expo first.
    const hasJestDep =
      !!pkg.devDependencies?.jest || !!pkg.dependencies?.jest ||
      !!pkg.devDependencies?.['jest-expo'] || !!pkg.dependencies?.['jest-expo'];
    if (/\bjest\b/.test(testScript) && !testScript.startsWith('echo')) {
      expect(hasJestDep, 'mobile test invokes jest but jest is not in deps').toBe(true);
    }
  });
});

describe('Finding H16: CI has lint/typecheck/audit', () => {
  it('turbo.json declares lint and typecheck tasks', () => {
    const turbo = readJSON<TurboJson>('turbo.json');
    expect(turbo.tasks.lint, 'turbo.json missing lint task').toBeDefined();
    expect(turbo.tasks.typecheck, 'turbo.json missing typecheck task').toBeDefined();
    // lint and typecheck should have inputs so they cache properly
    expect(turbo.tasks.lint.inputs?.length).toBeGreaterThan(0);
    expect(turbo.tasks.typecheck.inputs?.length).toBeGreaterThan(0);
  });

  it('every TS workspace has lint + typecheck scripts', () => {
    const workspaces = ['api', 'shared', 'web', 'worker', 'cli', 'mobile'];
    for (const ws of workspaces) {
      const pkg = readJSON<PkgJson>(`packages/${ws}/package.json`);
      expect(pkg.scripts?.lint, `packages/${ws} missing lint script`).toBeDefined();
      expect(pkg.scripts?.typecheck, `packages/${ws} missing typecheck script`).toBeDefined();
    }
  });

  it('deploy workflow runs lint, typecheck, test, audit, build in order', () => {
    const yml = readText('.github/workflows/deploy.yml');
    const lintIdx = yml.indexOf('turbo lint');
    const typecheckIdx = yml.indexOf('turbo typecheck');
    const testIdx = yml.indexOf('turbo test');
    const auditIdx = yml.indexOf('npm audit --audit-level=critical');
    const buildIdx = yml.indexOf('turbo build');

    expect(lintIdx, 'deploy.yml missing lint step').toBeGreaterThan(0);
    expect(typecheckIdx, 'deploy.yml missing typecheck step').toBeGreaterThan(0);
    expect(testIdx, 'deploy.yml missing test step').toBeGreaterThan(0);
    expect(auditIdx, 'deploy.yml missing audit step').toBeGreaterThan(0);
    expect(buildIdx, 'deploy.yml missing build step').toBeGreaterThan(0);

    // ordering: lint -> typecheck -> test -> audit -> build
    expect(lintIdx).toBeLessThan(typecheckIdx);
    expect(typecheckIdx).toBeLessThan(testIdx);
    expect(testIdx).toBeLessThan(auditIdx);
    expect(auditIdx).toBeLessThan(buildIdx);
  });
});

describe('Finding H17: deploy uses migrate:run, not push --force', () => {
  it('deploy workflow does not invoke drizzle-kit push', () => {
    const yml = readText('.github/workflows/deploy.yml');
    expect(yml).not.toMatch(/drizzle-kit\s+push/);
  });

  it('deploy workflow invokes db:migrate:run', () => {
    const yml = readText('.github/workflows/deploy.yml');
    expect(yml).toMatch(/npm run -w @homer-io\/api db:migrate:run/);
  });

  it('api package has db:migrate:run script', () => {
    const pkg = readJSON<PkgJson>('packages/api/package.json');
    expect(pkg.scripts?.['db:migrate:run']).toBeDefined();
  });
});
