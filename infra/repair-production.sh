#!/usr/bin/env bash
set -euo pipefail

REPOSITORY_DIR=/opt/homer-io
SOURCE_CADDYFILE="${1:-$REPOSITORY_DIR/infra/Caddyfile}"
LIVE_CADDYFILE=/etc/caddy/Caddyfile

cd "$REPOSITORY_DIR"

node --env-file=.env <<'NODE'
const crypto = require('node:crypto');
const fs = require('node:fs');

const envPath = '.env';
const placeholders = {
  JWT_SECRET: 'dev-only-change-me-rotate-in-prod-0123456789abcdef0123456789abcdef',
  INTEGRATION_ENCRYPTION_KEY: 'change-this-to-a-random-64-char-string-generated-by-openssl-rand',
};

function isSecure(name) {
  const value = process.env[name] ?? '';
  return value.length >= 32 && value !== placeholders[name];
}

function upsertEnv(content, name, value) {
  const linePattern = new RegExp(`^(?:export\\s+)?${name}\\s*=.*$`, 'gm');
  const normalized = content.endsWith('\n') ? content : `${content}\n`;
  return linePattern.test(normalized)
    ? normalized.replace(linePattern, `${name}=${value}`)
    : `${normalized}${name}=${value}\n`;
}

async function countEncryptedRecords() {
  const postgres = require('postgres');
  const sql = postgres(
    process.env.DATABASE_URL || 'postgresql://homer:homer@localhost:5432/homer',
    { max: 1, connect_timeout: 5, idle_timeout: 1 },
  );

  async function countOrZeroWhenTableIsMissing(statement) {
    try {
      const rows = await sql.unsafe(statement);
      return Number(rows[0].count);
    } catch (error) {
      if (error?.code === '42P01') return 0;
      throw error;
    }
  }

  try {
    const counts = await Promise.all([
      countOrZeroWhenTableIsMissing('SELECT count(*)::int AS count FROM integration_connections'),
      countOrZeroWhenTableIsMissing('SELECT count(*)::int AS count FROM telematics_connections'),
      countOrZeroWhenTableIsMissing(
        "SELECT count(*)::int AS count FROM migration_jobs WHERE config ? 'apiKey' AND coalesce(config->>'apiKey', '') <> ''",
      ),
    ]);
    return counts.reduce((total, count) => total + count, 0);
  } finally {
    await sql.end({ timeout: 1 });
  }
}

(async () => {
  const replacements = {};

  if (!isSecure('JWT_SECRET')) {
    replacements.JWT_SECRET = crypto.randomBytes(32).toString('hex');
  }

  if (!isSecure('INTEGRATION_ENCRYPTION_KEY')) {
    const encryptedRecordCount = await countEncryptedRecords();
    if (encryptedRecordCount > 0) {
      console.error(
        'INTEGRATION_ENCRYPTION_KEY is invalid and encrypted integration, telematics, or migration records exist; refusing to rotate it automatically',
      );
      process.exit(1);
    }
    replacements.INTEGRATION_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
  }

  const replacementEntries = Object.entries(replacements);
  if (replacementEntries.length === 0) {
    console.log('Production secrets passed validation.');
    return;
  }

  let content = fs.readFileSync(envPath, 'utf8');
  for (const [name, value] of replacementEntries) {
    content = upsertEnv(content, name, value);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '');
  const backupPath = `${envPath}.before-homer-repair-${timestamp}`;
  const temporaryPath = `${envPath}.homer-repair-${process.pid}-${crypto.randomBytes(6).toString('hex')}`;
  fs.copyFileSync(envPath, backupPath);
  fs.chmodSync(backupPath, 0o600);
  try {
    fs.writeFileSync(temporaryPath, content, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    fs.renameSync(temporaryPath, envPath);
  } finally {
    if (fs.existsSync(temporaryPath)) fs.rmSync(temporaryPath);
  }

  console.log(`Generated ${replacementEntries.map(([name]) => name).join(' and ')} locally on the production host.`);
  if (replacements.JWT_SECRET) {
    console.log('Existing login sessions, if any, must sign in again.');
  }
})().catch((error) => {
  console.error(`Production secret preflight failed: ${error.message}`);
  process.exit(1);
});
NODE

umask 077
candidate_caddyfile="$(mktemp "${TMPDIR:-/tmp}/homer-caddy.XXXXXX")"
trap 'rm -f "$candidate_caddyfile"' EXIT

node - "$LIVE_CADDYFILE" "$SOURCE_CADDYFILE" "$candidate_caddyfile" <<'NODE'
const fs = require('node:fs');

const [livePath, sourcePath, outputPath] = process.argv.slice(2);
const site = 'homer.discordwell.com';
const header = /^\s*homer\.discordwell\.com\s*\{\s*(?:#.*)?$/;

function findSiteBlock(text, path) {
  const lines = (text.match(/[^\n]*(?:\n|$)/g) ?? []).filter(Boolean);
  const matches = [];
  let offset = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!header.test(line.replace(/[\r\n]+$/, ''))) {
      offset += line.length;
      continue;
    }

    let depth = 0;
    let end = null;
    let cursor = offset;
    for (const blockLine of lines.slice(index)) {
      const code = blockLine.split('#', 1)[0];
      depth += (code.match(/\{/g) ?? []).length;
      depth -= (code.match(/\}/g) ?? []).length;
      cursor += blockLine.length;
      if (depth === 0) {
        end = cursor;
        break;
      }
    }

    if (end === null) {
      throw new Error(`Unclosed ${site} block in ${path}`);
    }
    matches.push([offset, end]);
    offset += line.length;
  }

  if (matches.length !== 1) {
    throw new Error(`Expected exactly one ${site} block in ${path}, found ${matches.length}`);
  }
  return matches[0];
}

const live = fs.readFileSync(livePath, 'utf8');
const source = fs.readFileSync(sourcePath, 'utf8');
const [liveStart, liveEnd] = findSiteBlock(live, livePath);
const [sourceStart, sourceEnd] = findSiteBlock(source, sourcePath);
const replacement = `${source.slice(sourceStart, sourceEnd).trimEnd()}\n`;
fs.writeFileSync(outputPath, live.slice(0, liveStart) + replacement + live.slice(liveEnd));
NODE

sudo -n caddy validate --config "$candidate_caddyfile" --adapter caddyfile

for process_name in homer-api homer-worker; do
  pm2 restart infra/ecosystem.config.cjs --only "$process_name" --update-env \
    || pm2 start infra/ecosystem.config.cjs --only "$process_name"
done

api_ready=false
worker_ready=false
for attempt in 1 2 3 4 5 6 7 8 9 10; do
  api_ready=false
  worker_ready=false
  if curl -fsS http://127.0.0.1:3000/health > /dev/null; then
    api_ready=true
  fi
  worker_pid="$(pm2 pid homer-worker | tail -1 | tr -d '[:space:]')"
  if [[ "$worker_pid" =~ ^[1-9][0-9]*$ ]]; then
    worker_ready=true
  fi
  if [ "$api_ready" = true ] && [ "$worker_ready" = true ]; then break; fi
  sleep 2
done

if [ "$api_ready" != true ] || [ "$worker_ready" != true ]; then
  echo "The API or worker did not recover; inspect: pm2 logs --lines 100 --nostream" >&2
  exit 1
fi

backup_path="$LIVE_CADDYFILE.before-homer-repair-$(date +%Y%m%d%H%M%S)"
sudo -n cp "$LIVE_CADDYFILE" "$backup_path"
sudo -n install -o root -g root -m 0644 "$candidate_caddyfile" "$LIVE_CADDYFILE"

if ! sudo -n systemctl reload caddy; then
  sudo -n cp "$backup_path" "$LIVE_CADDYFILE"
  sudo -n systemctl reload caddy
  echo "Caddy reload failed; the previous configuration was restored" >&2
  exit 1
fi
sudo -n systemctl is-active --quiet caddy

echo "The Homer API and worker are healthy, and only the homer.discordwell.com Caddy block was updated."
