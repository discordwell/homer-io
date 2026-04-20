#!/usr/bin/env node
/**
 * verify-port-consistency.mjs
 *
 * Guards Finding H14: the API port is declared in three places and a
 * divergence causes silent 502s on deploy. This script reads all three
 * and fails (exit 1) if they disagree.
 *
 * Sources checked:
 *   1. infra/ecosystem.config.cjs     — PM2 env.PORT (what the API binds to in prod)
 *   2. infra/Caddyfile                — reverse_proxy target for api.homer.io
 *   3. .env.example                   — the PORT= default shipped to devs
 *
 * Usage: node scripts/verify-port-consistency.mjs
 * Exits 0 if all three match, 1 otherwise.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '..');

function readFile(rel) {
  return readFileSync(resolve(repoRoot, rel), 'utf8');
}

function extractEcosystemPort(text) {
  // match `PORT: 3000,` or `PORT: 3000`
  const m = text.match(/PORT:\s*(\d+)/);
  if (!m) throw new Error('Could not find PORT in infra/ecosystem.config.cjs');
  return Number(m[1]);
}

function extractCaddyApiPort(text) {
  // Find the block `api.homer.io { ... reverse_proxy localhost:<port> ... }`
  const block = text.match(/api\.homer\.io\s*\{[^}]*\}/s);
  if (!block) throw new Error('Could not find api.homer.io block in infra/Caddyfile');
  const m = block[0].match(/reverse_proxy\s+localhost:(\d+)/);
  if (!m) throw new Error('Could not find reverse_proxy localhost:<port> in api.homer.io block');
  return Number(m[1]);
}

function extractEnvExamplePort(text) {
  // Match the top-level PORT= (not MINIO_PORT= etc.)
  const m = text.match(/^PORT=(\d+)/m);
  if (!m) throw new Error('Could not find PORT= in .env.example');
  return Number(m[1]);
}

const sources = [
  {
    name: 'infra/ecosystem.config.cjs (PM2 env.PORT)',
    port: extractEcosystemPort(readFile('infra/ecosystem.config.cjs')),
  },
  {
    name: 'infra/Caddyfile (api.homer.io reverse_proxy)',
    port: extractCaddyApiPort(readFile('infra/Caddyfile')),
  },
  {
    name: '.env.example (PORT=)',
    port: extractEnvExamplePort(readFile('.env.example')),
  },
];

const ports = new Set(sources.map((s) => s.port));

if (ports.size === 1) {
  const [canonical] = ports;
  console.log(`OK: all three sources agree on API port ${canonical}`);
  for (const s of sources) console.log(`  - ${s.name} = ${s.port}`);
  process.exit(0);
}

console.error('FAIL: API port mismatch between infra sources');
for (const s of sources) console.error(`  - ${s.name} = ${s.port}`);
console.error('Fix: pick a canonical port and align all three.');
process.exit(1);
