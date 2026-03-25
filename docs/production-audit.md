# Production Audit

This repo now includes a root-level audit scaffold designed to support repeated productionization passes instead of one-off "looks fine" checks.

## Commands

- `npm run audit:prep`
- `npm run audit:inventory`
- `npm run audit:cycle`
- `npm run audit:report`
- `npm run audit:browser:public`
- `npm run audit:test`

## What It Automates Today

- Frontend route extraction from `packages/web/src/App.tsx`
- Route-reference integrity checks across page and component navigation code
- Backend deep-link checks against the frontend route surface
- Live-surface probes for `homer.discordwell.com`, `homer.io`, `app.homer.io`, and `api.homer.io/health`
- Web-package baseline checks via `npm run -w @homer-io/web test` and `npm run -w @homer-io/web build`
- Route-matrix generation with personas, quotas, and required states for repeated wet-review passes
- Playwright-driven public-site wet checks with screenshots, delayed-collapse detection, CTA verification, and cross-route copy/templating heuristics

## Output

Generated artifacts are written to `.audit/`.

- `.audit/prep.json`
- `.audit/inventory.json`
- `.audit/latest-run.json`
- `.audit/runs/<timestamp>/inventory.json`
- `.audit/runs/<timestamp>/issues.json`
- `.audit/runs/<timestamp>/probes.json`
- `.audit/runs/<timestamp>/build-checks.json`
- `.audit/runs/<timestamp>/report.md`
- `.audit/browser-public/<timestamp>/results.json`
- `.audit/browser-public/<timestamp>/report.md`
- `.audit/browser-public/<timestamp>/screenshots/*.png`

## Wet Review Queue

The current implementation intentionally does not pretend static checks are enough to certify UI quality. Each route is emitted with a pass quota and marked for manual wet review so a single agent can keep iterating with browser navigation and screenshots.

`audit:browser:public` targets the live public site by default. Override it for local verification with `AUDIT_PUBLIC_SITE=http://127.0.0.1:4173 npm run audit:browser:public`.
