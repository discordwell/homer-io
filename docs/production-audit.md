# Production Audit

This repo now includes a root-level audit scaffold designed to support repeated productionization passes instead of one-off "looks fine" checks.

## Commands

- `npm run audit:prep`
- `npm run audit:inventory`
- `npm run audit:cycle`
- `npm run audit:report`
- `npm run audit:browser:public`
- `npm run audit:browser:seeded`
- `npm run audit:test`

## What It Automates Today

- Frontend route extraction from `packages/web/src/App.tsx`
- Route-reference integrity checks across page and component navigation code
- Backend deep-link checks against the frontend route surface
- Live-surface probes for the configured public site and apex domain
- Optional app/API host probes via `AUDIT_LIVE_APP` and `AUDIT_LIVE_API_HEALTH`; leave them unset when the deployment runs on a single public host.
- Web-package baseline checks via `npm run -w @homer-io/web test` and `npm run -w @homer-io/web build`
- Route-matrix generation with personas, quotas, and required states for repeated wet-review passes
- Playwright-driven public-site wet checks with screenshots, delayed-collapse detection, CTA verification, and cross-route copy/templating heuristics
- Playwright-driven seeded wet checks for protected owner, driver, and demo-internal routes using stubbed auth and API fixtures instead of a live backend dependency

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
- `.audit/browser-seeded/<timestamp>/results.json`
- `.audit/browser-seeded/<timestamp>/report.md`
- `.audit/browser-seeded/<timestamp>/screenshots/*.png`

## Wet Review Queue

The current implementation intentionally does not pretend static checks are enough to certify UI quality. Each route is emitted with a pass quota and marked for manual wet review so a single agent can keep iterating with browser navigation and screenshots.

`audit:browser:public` targets the live public site by default. Override it for local verification with `AUDIT_PUBLIC_SITE=http://127.0.0.1:4173 npm run audit:browser:public`.

`audit:browser:seeded` targets a local preview build by default at `http://127.0.0.1:4173`. Override it with `AUDIT_SEEDED_SITE=...` when you want the same seeded matrix against another local surface. The current seeded matrix covers:

- owner dashboard home, orders, routes, messages, billing-blocked, stale-auth, and mobile navigation
- driver route, empty route, profile, and non-driver access rejection
- demo subroute entry via the email gate plus provisioning failure recovery
