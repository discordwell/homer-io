import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ROOT_DIR = path.resolve(__dirname, '../../..');
export const OUTPUT_DIR = path.join(ROOT_DIR, '.audit');
export const RUNS_DIR = path.join(OUTPUT_DIR, 'runs');
export const LATEST_RUN_FILE = path.join(OUTPUT_DIR, 'latest-run.json');
export const PREP_FILE = path.join(OUTPUT_DIR, 'prep.json');
export const INVENTORY_FILE = path.join(OUTPUT_DIR, 'inventory.json');

export const FILES = {
  rootPackageJson: path.join(ROOT_DIR, 'package.json'),
  appTsx: path.join(ROOT_DIR, 'packages/web/src/App.tsx'),
  mainTsx: path.join(ROOT_DIR, 'packages/web/src/main.tsx'),
  webRoot: path.join(ROOT_DIR, 'packages/web/src'),
  apiRoot: path.join(ROOT_DIR, 'packages/api/src'),
  caddyfile: path.join(ROOT_DIR, 'infra/Caddyfile'),
  webPackageJson: path.join(ROOT_DIR, 'packages/web/package.json'),
  apiPackageJson: path.join(ROOT_DIR, 'packages/api/package.json'),
  envExample: path.join(ROOT_DIR, '.env.example'),
};

function readAuditSurface(name, fallback = '') {
  return (process.env[name] || fallback).trim();
}

export const LIVE_SURFACES = {
  apex: readAuditSurface('AUDIT_LIVE_APEX', 'https://homer.io'),
  publicSite: readAuditSurface('AUDIT_LIVE_PUBLIC_SITE', 'https://homer.discordwell.com'),
  app: readAuditSurface('AUDIT_LIVE_APP'),
  apiHealth: readAuditSurface('AUDIT_LIVE_API_HEALTH'),
  track: readAuditSurface('AUDIT_LIVE_TRACK', 'https://track.homer.io'),
};

export const PASS_QUOTAS = {
  marketing: 24,
  auth: 40,
  demo: 40,
  tracking: 40,
  dashboard: 72,
  driver: 80,
  unknown: 24,
};

export const REQUIRED_STATES = {
  marketing: ['desktop', 'tablet', 'mobile', 'direct-load', 'cta-nav', 'hash-nav'],
  auth: ['desktop', 'mobile', 'invalid-input', 'api-error', 'success', 'deep-link'],
  demo: ['desktop', 'mobile', 'email-gate', 'provisioning', 'ready', 'retry'],
  tracking: ['desktop', 'mobile', 'valid-id', 'invalid-id', 'in-transit', 'delivered'],
  dashboard: ['desktop', 'tablet', 'mobile', 'populated', 'empty', 'error', 'stale-auth', 'billing-blocked'],
  driver: ['mobile', 'role-valid', 'role-invalid', 'stale-auth', 'offline', 'location-denied'],
  unknown: ['desktop', 'mobile', 'direct-load'],
};

export const REQUIRED_ACTIONS = {
  marketing: ['open', 'scroll', 'activate-primary-cta', 'activate-secondary-cta'],
  auth: ['open', 'submit-invalid', 'submit-valid', 'refresh', 'direct-link'],
  demo: ['open', 'submit-email', 'retry', 'refresh', 'navigate-subroute'],
  tracking: ['open', 'refresh', 'invalid-parameter', 'deep-link'],
  dashboard: ['open', 'refresh', 'back-forward', 'open-primary-action', 'exercise-empty-state'],
  driver: ['open', 'refresh', 'open-primary-action', 'back-forward', 'offline-resume'],
  unknown: ['open', 'refresh'],
};

// Audit baseline date: the date the report was generated for.
// Previously this was hardcoded to '2026-03-24' which caused reports to drift
// and misrepresent when they were generated. Use TODAY for live generation;
// FROZEN_TODAY remains for any callers that need a reproducible snapshot date.
export const FROZEN_TODAY = '2026-03-24';
export const TODAY = new Date().toISOString().split('T')[0];
