import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', '.turbo', '.audit']);

export async function mkdirp(dir) {
  await fs.mkdir(dir, { recursive: true });
}

export async function readText(filePath) {
  return fs.readFile(filePath, 'utf8');
}

export async function readJson(filePath) {
  const text = await readText(filePath);
  return JSON.parse(text);
}

export async function writeJson(filePath, value) {
  await mkdirp(path.dirname(filePath));
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export async function writeText(filePath, value) {
  await mkdirp(path.dirname(filePath));
  await fs.writeFile(filePath, value, 'utf8');
}

export async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function listFiles(rootDir, predicate = () => true) {
  const results = [];

  async function walk(currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.env.example') {
        if (SKIP_DIRS.has(entry.name)) continue;
      }
      if (SKIP_DIRS.has(entry.name)) continue;
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (predicate(fullPath)) {
        results.push(fullPath);
      }
    }
  }

  await walk(rootDir);
  results.sort();
  return results;
}

export function relativeToRoot(rootDir, filePath) {
  return path.relative(rootDir, filePath).split(path.sep).join('/');
}

export function lineFromIndex(text, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (text.charCodeAt(i) === 10) line += 1;
  }
  return line;
}

export function timestampSlug(now = new Date()) {
  return now.toISOString().replaceAll(':', '-').replace(/\..+$/, 'Z');
}

export async function runCommand(command, args, options = {}) {
  const {
    cwd,
    env,
  } = options;

  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('close', (code) => {
      resolve({
        code: code ?? 0,
        stdout,
        stderr,
        combined: `${stdout}${stderr}`,
      });
    });
  });
}

export function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function stripQueryAndHash(target) {
  return target.split('#')[0].split('?')[0] || '/';
}

export function normalizePath(target) {
  if (!target) return '/';
  const clean = stripQueryAndHash(target)
    .replace(/\/{2,}/g, '/')
    .replace(/\/$/, '');
  return clean === '' ? '/' : clean;
}

export async function safeFetch(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 10000);

  try {
    const response = await fetch(url, {
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        'user-agent': 'homer-audit/0.1',
        ...(options.headers || {}),
      },
    });
    const body = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body,
      error: null,
      finalUrl: response.url,
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      headers: {},
      body: '',
      error: error instanceof Error ? error.message : String(error),
      finalUrl: url,
    };
  } finally {
    clearTimeout(timeout);
  }
}
