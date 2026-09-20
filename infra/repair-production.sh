#!/usr/bin/env bash
set -euo pipefail

REPOSITORY_DIR=/opt/homer-io
SOURCE_CADDYFILE="${1:-$REPOSITORY_DIR/infra/Caddyfile}"
LIVE_CADDYFILE=/etc/caddy/Caddyfile

cd "$REPOSITORY_DIR"

node --env-file=.env <<'NODE'
const checks = [
  ['JWT_SECRET', 'dev-only-change-me-rotate-in-prod-0123456789abcdef0123456789abcdef'],
  ['INTEGRATION_ENCRYPTION_KEY', 'change-this-to-a-random-64-char-string-generated-by-openssl-rand'],
];

for (const [name, placeholder] of checks) {
  const value = process.env[name] ?? '';
  if (value.length < 32 || value === placeholder) {
    console.error(`${name} is missing, too short, or still a public placeholder; repair stopped without changing production`);
    process.exit(1);
  }
}
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

pm2 restart infra/ecosystem.config.cjs --only homer-api --update-env \
  || pm2 start infra/ecosystem.config.cjs --only homer-api

api_ready=false
for attempt in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS http://127.0.0.1:3000/health > /dev/null; then
    api_ready=true
    break
  fi
  sleep 2
done

if [ "$api_ready" != true ]; then
  echo "The API did not recover; inspect: pm2 logs homer-api --lines 100 --nostream" >&2
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

echo "The Homer API is healthy and only the homer.discordwell.com Caddy block was updated."
