import { describe, it, expect, vi, afterEach, afterAll } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// config.ts resolves the config path from homedir() at import time, so the
// mock must be in place before the module loads.
const mocked = vi.hoisted(() => ({
  home: `${(process.env.TMPDIR || '/tmp').replace(/\/+$/, '')}/homer-cli-config-test-${process.pid}`,
}));

vi.mock('node:os', async (importOriginal) => {
  const os = await importOriginal<typeof import('node:os')>();
  return { ...os, homedir: () => mocked.home };
});

const { loadConfig, saveConfig, clearConfig, DEFAULT_SERVER_URL } = await import('../config.js');

const CONFIG_DIR = join(mocked.home, '.homer');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

afterEach(() => {
  rmSync(CONFIG_DIR, { recursive: true, force: true });
});

afterAll(() => {
  rmSync(mocked.home, { recursive: true, force: true });
});

describe('config', () => {
  it('loadConfig returns null when no config file exists', () => {
    expect(loadConfig()).toBeNull();
  });

  it('saveConfig then loadConfig round-trips', () => {
    saveConfig({ apiKey: 'hio_test123', serverUrl: 'https://example.com' });
    expect(loadConfig()).toEqual({ apiKey: 'hio_test123', serverUrl: 'https://example.com' });
  });

  it('saveConfig fills in the default server URL when omitted', () => {
    saveConfig({ apiKey: 'hio_test123' });
    expect(loadConfig()).toEqual({ apiKey: 'hio_test123', serverUrl: DEFAULT_SERVER_URL });
  });

  it('saveConfig creates the config directory and writes pretty JSON with trailing newline', () => {
    saveConfig({ apiKey: 'k' });
    const raw = readFileSync(CONFIG_FILE, 'utf-8');
    expect(raw.endsWith('\n')).toBe(true);
    expect(JSON.parse(raw)).toEqual({ apiKey: 'k', serverUrl: DEFAULT_SERVER_URL });
  });

  it('loadConfig returns null for malformed JSON', () => {
    mkdirSync(CONFIG_DIR, { recursive: true });
    writeFileSync(CONFIG_FILE, 'not json{', 'utf-8');
    expect(loadConfig()).toBeNull();
  });

  it('loadConfig returns null when apiKey is missing', () => {
    mkdirSync(CONFIG_DIR, { recursive: true });
    writeFileSync(CONFIG_FILE, JSON.stringify({ serverUrl: 'https://example.com' }), 'utf-8');
    expect(loadConfig()).toBeNull();
  });

  it('loadConfig falls back to the default server URL when the file omits it', () => {
    mkdirSync(CONFIG_DIR, { recursive: true });
    writeFileSync(CONFIG_FILE, JSON.stringify({ apiKey: 'k' }), 'utf-8');
    expect(loadConfig()).toEqual({ apiKey: 'k', serverUrl: DEFAULT_SERVER_URL });
  });

  it('clearConfig removes the config file', () => {
    saveConfig({ apiKey: 'k' });
    expect(existsSync(CONFIG_FILE)).toBe(true);
    clearConfig();
    expect(existsSync(CONFIG_FILE)).toBe(false);
    expect(loadConfig()).toBeNull();
  });

  it('clearConfig is a no-op when no config file exists', () => {
    expect(() => clearConfig()).not.toThrow();
  });
});
