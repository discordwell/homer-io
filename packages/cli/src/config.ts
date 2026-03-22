import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export interface HomerConfig {
  apiKey: string;
  serverUrl: string;
}

const CONFIG_DIR = join(homedir(), '.homer');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');
const DEFAULT_SERVER_URL = 'https://homer.discordwell.com';

export function loadConfig(): HomerConfig | null {
  if (!existsSync(CONFIG_FILE)) {
    return null;
  }
  try {
    const raw = readFileSync(CONFIG_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<HomerConfig>;
    if (!parsed.apiKey) {
      return null;
    }
    return {
      apiKey: parsed.apiKey,
      serverUrl: parsed.serverUrl || DEFAULT_SERVER_URL,
    };
  } catch {
    return null;
  }
}

export function saveConfig(config: { apiKey: string; serverUrl?: string }): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  const data: HomerConfig = {
    apiKey: config.apiKey,
    serverUrl: config.serverUrl || DEFAULT_SERVER_URL,
  };
  writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

export function clearConfig(): void {
  if (existsSync(CONFIG_FILE)) {
    unlinkSync(CONFIG_FILE);
  }
}

export { DEFAULT_SERVER_URL };
