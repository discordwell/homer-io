# Claudepad — Session Memory

## Session Summaries

### 2026-08-21T19:15 UTC — Feature: light mode (light / dark / system) across the whole web surface

- **Ask**: user wanted a light mode alongside the default dark, switchable night/dark/system. Scoped via AskUserQuestion to **everything including the marketing landing**, with the switcher in **topnav + Settings**.
- **Shape**: `app.css` was already fully tokenized, so the core is a token swap. Dark stays on bare `:root`; light overrides only what changes under `html[data-theme='light']`. Dark is the product default — absent attribute means dark.
- **Pre-paint**: `public/theme-init.js` (render-blocking, external) stamps `data-theme` before first paint. It **cannot** be inline: the CSP in `index.html` is `script-src 'self'` with no `'unsafe-inline'`. Its resolution logic is deliberately duplicated from `stores/theme.ts`; `theme.test.ts` runs the real file via `new Function` against a fake window and asserts parity over every (stored × OS-pref) combination, including the no-`matchMedia` case where the two originally diverged.
- **No `prefers-color-scheme` fallback in CSS, on purpose**: this is a React SPA (no JS ⇒ blank page anyway), and a media fallback would flash *light* at a dark-mode user whenever `theme-init.js` is slow or 404s.
- **Store**: `stores/theme.ts` is zustand but does **not** use `persist` — it writes a bare string to `localStorage['homer-theme']` so the dependency-free init script can read the same value. `initTheme()` in `main.tsx` re-applies and subscribes to `prefers-color-scheme`.
- **Three token roles that can't be one value**: `--accent` (fill) vs `--accent-text` (foreground; bright amber is 2.2:1 on white) vs `--on-accent` (text on an accent fill; white-on-amber fails AA in *both* themes). Plus `--border-strong` (the app's de-facto border in ~170 places; equals `--t3` in dark so dark is unchanged) and `--field-bg`/`--field-border` (in light the card and the field are both white).
- **Colors outside CSS**: empirically probed — browsers **do** resolve `var()` in SVG presentation attributes (so recharts and inline SVG were never broken), but **Canvas 2D does not** (`fillStyle` rejects it and paints black), and neither do MapLibre style specs. `map-theme.ts` / `maplibreStyle.ts` / `BayAreaMap.tsx` / `driverAnimator.ts` carry theme-keyed literal hex. Leaflet tiles swap via `setUrl()`, and `fitBounds` is guarded by a geometry signature so a theme toggle never discards the user's pan/zoom.
- **Bugs found and fixed along the way** (all pre-existing except where noted):
  - **Production build rendered a blank page.** Rollup inlined zustand into the entry chunk; lazily-loaded store chunks imported `create` back *from* the entry, so they evaluated first and every `create(...)` at module scope threw "is not a function". Dev never reproduces (unbundled) and `vite build` exits 0. Fixed with a `manualChunks` rule; `build-chunks.test.ts` walks `dist/assets` for static-import cycles and was verified to fail on the unfixed build (`index → auth → index`).
  - **Hex-alpha concatenation on CSS vars** — `` `${C.green}18` `` yields the literal `var(--green)18`, invalid CSS, dropped silently. 10 sites (Badge, RiskBadge, Toast, KPICard, SubscriptionBanner, HealthDashboard, DispatchPreview, PublicTracking). Badges had been rendering with no background and no border. **Note: fixing this visibly changes dark mode** — badges now have their intended tint.
  - **`alpha()` returned the color opaque for unmapped tokens**, warning only in DEV. Regressed the dispatch spinner (track and head the same color) once I introduced `alpha(C.onAccent, …)`. Now throws outside prod, with `theme.test.ts` pinning every token.
  - White-on-amber in ConfirmDialog / AIChatPanel / chat bubbles / PlanSelector / Migration (2.1:1 dark, 3.0:1 light).
  - `--t3-rgb` was `101,116,139` for `#64748B` — off by one on red.
- **Known shortfall, pinned not fixed**: dark `--t3` on `--bg-card` is 3.73:1 (fails AA for small text). Pre-existing; fixing it means darkening every muted label in dark, which is a deliberate visual change and not part of adding light mode. `theme-tokens.test.ts` asserts it can't get worse.
- **Flagged, deliberately not fixed** (pre-existing, out of scope): the hero MapLibre map **never loads** — `loadMapLibre.ts` pulls the script from `unpkg.com`, which is not in the CSP's `script-src`. unpkg is reachable (200); the CSP blocks it. So the landing always renders the SVG fallback, and the `maplibreStyle`/`driverAnimator` theming is correct but on a currently-unreachable path. Allowing a third-party CDN in `script-src` is a security call for the user.
- **Verification**: 254 tests green (23 files, +9), typecheck clean, lint 0 errors / 6 pre-existing warnings, build succeeds. Wet-tested in a real browser across landing, vertical landing, pricing, login, dashboard, settings, orders, live map, driver profile — in both themes, plus rapid toggling, reload persistence, and live tile swap. The wet test found 5 light-mode bugs a diff read would not have (dark glass panel on `/cannabis`, dark-blue demo banner, white-on-white auth inputs, boot-style specificity pinning `body` to the wrong background, hero grid invisible).

### 2026-06-19T02:00 UTC — Maintenance pass: 5 correctness bugs across connectors, notifications, address dedup, billing
- **Why**: Mature repo, clean tree. Fanned out 4 bug-hunting subagents over the logistics core (routing/dispatch, billing/analytics, tracking/geofence/notifications, orders/POD/connectors). Each candidate independently verified before fixing; an adversarial code-review subagent reviewed the full diff pre-commit. Landed 5 genuine bugs + 1 review-found edge guard, each with a discriminating test. Suite 1253 → 1273 (+20). No migrations.
- **Fix 1 — Square line-item price ÷100 twice** (`lib/integrations/square.ts`): `toExternal` already converts Square cents→dollars, but `mapOrderToHomer` divided by 100 again, rendering a $12.00 item as "$0.12" in the driver-facing order notes. Square-only (Toast/Dutchie format already-dollar prices once). Test: new `connector-mapping.test.ts`.
- **Fix 2 — createTemplate dropped recipientType** (`modules/customer-notifications/service.ts`): the insert omitted `recipientType`, so every template created via the app UI was forced to the column default `'recipient'`, silently breaking florist *sender*/*both* notifications (the gift-giver who paid never heard the delivery landed). `updateTemplate` already persisted it via `...input`, so the bug was creation-only; the demo seed wrote it explicitly, masking it. Test: new `customer-notifications-service.test.ts` (db-mock captures the inserted row).
- **Fix 3 — address normalization left a trailing comma** (`shared/utils/address.ts` + `web/utils/address-hash.ts`, kept in lockstep): every e-commerce/POS connector joins address line1/line2 with `", "`, so stripping a unit from `"123 Main St, Apt 4"` left `"123 main st,"` — a *different* building hash from the manually-typed `"123 Main St Apt 4"` (`"123 main st"`), fragmenting per-building address-intelligence + risk history. Fix: treat commas as separators (`.replace(/,/g,' ')`). No-comma addresses are unchanged (no dedup regression); distinct buildings still differ by street number/name (no merge). Tests in api + web address suites.
- **Fix 4 — podStorageMb overage billed 1024×** (`modules/billing/service.ts`): `getMeteredUsage` multiplied an MB overage by a per-GB rate (`10¢ / 1024 MB`) without converting, so 3 GB of POD storage projected $204.80 instead of $0.20. Extracted pure `computeOverageCosts(usage)` and convert MB→GB for `podStorageMb` only. Currently dormant (nothing meters podStorageMb yet) but surfaced in Settings→Billing. Test: new `billing-overage.test.ts` (asserts 20¢, explicitly not 20480¢).
- **Fix 5 — integration order-import skipped a once-failed order forever** (`modules/integrations/service.ts` AND worker `integration-sync.ts` — duplicated logic, both fixed): the dedup pre-fetch keyed off the mere existence of an `integration_orders` row, but a failed import writes a row with `orderId = null`. So a single transient/validation failure (e.g. a 300-char name) put the external id in the skip set permanently → the delivery was silently lost. Fix: new shared helper `collectImportedExternalIds` (dedup only on rows with a linked order; failed rows are retried); success-path insert became `onConflictDoUpdate` (flips a prior failed row to synced rather than throwing on the unique index); order+mapping inserts wrapped in `db.transaction` (no orphan order on partial failure); + review-found one-liner `existingIds.add()` to dedup duplicate externalIds within one fetch batch (orders.externalId has no unique constraint). No migration — the `uq_integration_order_dedup(connectionId, externalOrderId)` index already existed. Test: new shared `integration-sync.test.ts` (regression guard: a failed row is NOT treated as synced). Upsert/transaction wiring verified by the code-review subagent (both copies identical; `onConflictDoUpdate` target matches the unique index).
- **Verification**: full monorepo suite green — shared 86 (+4), api 922 (+15), web 201 (+1), worker 26, cli 38; typecheck 8/8; lint 0 errors. Committed on `main` as focused per-fix commits; not pushed (orchestrator handles push).

### 2026-06-18T13:20 UTC — Fix: learned avg service time used the wrong divisor (successful_deliveries)
- **Bug**: `address_intelligence.avg_service_time_seconds` — the per-address *learned* service time, surfaced on the intelligence dashboard ("best learned service times") and per-address widgets — was maintained in the worker's `upsertAddressIntelligence` as an incremental running average inside `INSERT … ON CONFLICT DO UPDATE`, dividing by `successful_deliveries`. But the service-time *samples* folded in come from `computeMetrics`, which records a time for ANY delivery (delivered or **failed**) that has a GPS arrival breadcrumb within 200m, and records **none** when there's no breadcrumb. So the divisor diverges from the true sample count whenever (a) a failed delivery records a time, or (b) a successful delivery records none — both common. The cached average drifts and the error compounds per delivery.
- **Why it hid**: the existing test (`api/.../delivery-learning.test.ts`) reimplemented the running-average *formula* with a *correct* sample count, so it validated arithmetic that production never ran — it never exercised the actual `successful_deliveries` divisor. (Same shape as the ETA/2-opt "tests asserted the happy-path, not the real path" bugs.)
- **Fix** (no migration — chosen deliberately; see Key Findings on the stale Drizzle journal): `delivery_metrics` holds the authoritative per-delivery `service_time_seconds` (one row/delivery, never pruned for real tenants), so removed the avg from the upsert entirely and added `recomputeAddressAvgServiceTime(tenantId, addressIntelId)` — `sum()/count()` over that address's metrics via a new pure, exported `averageServiceTimeSeconds(sum, count)` helper — called right after the metric row is inserted. `count(col)` ignores NULLs, so the divisor is exactly the recorded-sample count. Exact, and **self-healing**: any address already skewed is corrected on its next delivery (recompute reads ALL its rows). Column is nullable → briefly NULL between insert and recompute on first delivery; all 3 consumers already null-guard.
- **Tests**: new `packages/worker/src/workers/delivery-learning.test.ts` (8) — pure helper incl. the explicit divisor-regression case (`avg([100,200]) = 150 ≠ 300/3`) that fails against the old code, plus `recomputeAddressAvgServiceTime` wiring (bigint string→Number parse, null/empty-row → NULL write, numeric(10,2) string format). Rewrote the API test's stale "Running Averages" block to model mean-over-recorded-samples (was modeling the wrong thing).
- **Verification**: worker 26 (was 18) + API 907 (was 906) green; worker+API typecheck + lint clean. An adversarial code-review subagent confirmed the divisor fix is correct/cannot recur, the self-healing claim holds, types/null-handling are sound, and the new tests are discriminating. Its one **major** finding (the SELECT-then-INSERT dedup has no unique constraint on `delivery_metrics(order_id)`, so concurrent same-order jobs could double-count) is **pre-existing** — old code had the same dedup and the fix doesn't worsen it — and fixing it needs a constraint migration; recorded as a follow-up below. Committed on `main`; not pushed (orchestrator handles push).

### 2026-06-17T21:00 UTC — Fix: haversine-fallback ETAs double-counted dwell time (compounding per stop)
- **Bug**: The customer-facing ETA path (`lib/routing/index.ts`) falls back to haversine when both Google Routes and OSRM are unavailable — and the README documents OSRM as optional, so any deploy without OSRM runs this path for *every* ETA. Both fallbacks (`getTrafficAwareETAs` + `getOsrmETAs`) set each leg's `durationSeconds = estimateEtaMinutes(...) * 60`, but `estimateEtaMinutes` returns **travel + dwell**, while `buildEtaResult` then adds the stop's dwell *again*. Dwell was counted twice, and because ETAs are cumulative the error compounds: stop N was inflated by N × dwell (e.g. a 10-stop car route over-promised the last stop by ~30 min).
- **Why it hid**: the OSRM/Google paths feed real travel-only durations into the same `buildEtaResult`, so only the haversine fallback was wrong. The existing tests asserted only *relative* gaps (`diff >= 3`) and *differences of two buggy results* — both survive the double-count.
- **Fix**: extracted a travel-only `estimateTravelMinutes(...)` in `lib/geo.ts` (no dwell) and used it in both haversine loops, so legs carry travel only and `buildEtaResult` stays the single place dwell is applied. `estimateEtaMinutes` now calls the new helper + adds dwell — value-preserving for the integer dwell values in `dwellTimesMinutes` (verified by sweep). Added a comment at both call sites against re-introducing the double-count.
- **Tests**: +3 in `__tests__/routing/eta-service-duration.test.ts` pinning **absolute** ETAs — stop1 = travel + exactly one dwell, stop2 = cumulative travel + exactly two dwells (catches compounding), and per-stop `serviceDurationMinutes` applied once. Confirmed they *fail* on the old code (stop1 9.7 vs correct 6.7) and pass on the new; both fallback paths covered independently.
- **Verification**: API suite 906 (was 903), monorepo typecheck 8/8, lint 0 errors. A code-review subagent independently reproduced the bug to prove the tests are discriminating, swept 1.2M inputs to confirm `estimateEtaMinutes` output is unchanged, and confirmed no other leg-builder feeding `buildEtaResult` was affected. Committed on `main`; not pushed (orchestrator handles push).

### 2026-06-17T20:30 UTC — Fix: webhook deliveries never retried on transient failure (landed WIP + tests)
- **Bug**: The API enqueues each webhook delivery with BullMQ `attempts: 1`, but the worker's failure path threw `error` "to let BullMQ retry". With only one attempt a throw dead-letters the job — so transient endpoint failures (5xx, timeout, connection reset) were **never retried**, and the whole 30s→2m→15m→1h backoff ladder (`RETRY_DELAYS`, `nextRetryAt`) was dead code. Webhook reliability had silently degraded to single-shot.
- **Fix** (uncommitted WIP, now completed): the worker catches the error and **re-enqueues a delayed job** through its own `Queue('webhook-delivery')` instance instead of rethrowing; extracted `WEBHOOK_MAX_ATTEMPTS = 5` + `nextRetryDelayMs(attempt)` (pure, exported, testable). One `delayMs` drives both the persisted `nextRetryAt` and the BullMQ `delay`, so advertised and actual retry time stay identical. The API-side `attempts: 1` is kept (a new comment explains it must stay 1, else retries double).
- **Cleanup**: the SSRF-block path still hardcoded `attempts: 5` — migrated to `WEBHOOK_MAX_ATTEMPTS` (same value) to kill the last magic number and make "terminal, don't retry" explicit. Behavior unchanged.
- **Tests**: new `packages/worker/src/workers/webhook-delivery.test.ts` (9 tests) — `nextRetryDelayMs` ladder + boundaries + monotonicity; and `processWebhookDelivery` behavior: a transient failure re-enqueues with the correct delay and does NOT throw (the regression guard for the bug), 2nd-attempt delay, exhaustion → `failed` + no re-enqueue, success → no re-enqueue, SSRF target → terminal + no fetch/re-enqueue. Mocks bullmq/db/logger via `vi.hoisted` (matches the telematics-service.test.ts pattern).
- **Verification**: worker suite 18 (was 9) green; worker typecheck + lint clean; API typecheck + webhook tests (14) green. A 2-angle code-review subagent (correctness + cleanup/conventions) reviewed the staged diff — the correctness pass surfaced the hardcoded-5 straggler (applied), the cleanup pass came back clean. Committed on `main`; not pushed (orchestrator handles push).

### 2026-06-17T09:30 UTC — Fix: route-optimizer 2-opt was degrading routes
- **Bug**: The in-house VRP/TSP optimizer's 2-opt local search computed each move's gain for reversing segment `[i..j]` but then reversed `[i+1..j]` — an off-by-one mismatch between the *evaluated* and *applied* move. Net effect: it frequently accepted non-improving moves and got stuck **worse than its own nearest-neighbor starting tour**. Measured over 3k random instances: cost rose vs. the NN start in **42%** of cases; **71%** were suboptimal vs. brute force (avg 23%, worst 126% over optimal). This is the product's headline "route optimization" feature silently producing worse routes.
- **Root cause**: `twoOptDelta` used the `tour[i-1]→tour[i]` boundary edge while `reverse(result, i+1, j)` reversed a different segment; the gain never matched the change. The worker's duplicate copy (`packages/worker/.../lib/vrp-solver.ts`) was self-consistent but optimized a *closed*-tour objective (phantom return-to-depot leg) while `tourDuration` measures an *open* path — so it too raised real cost ~40% of the time.
- **Fix**: Rewrote `twoOpt` in both copies as a correct **open-path** 2-opt over `seq = [depot, ...stops]` with the depot as a fixed head anchor. The delta now exactly matches the reversed segment; the tail case (no return edge) is handled so the last stop can move and the depot→firstStop leg is optimized. Verified: **0** cost increases vs. NN over 5k instances; suboptimality gap drops to 5.3% avg / 30% worst. O(1)-per-move retained; symmetric-matrix assumption (haversine exact, OSRM near) documented.
- **Tests**: +4 API tests and a new 3-test worker suite — a concrete NN-zigzag→optimal case (1547→1344) plus property-based 2-opt **local-optimality** checks over hundreds of seeded random instances (with/without depot). Confirmed these guards *fail* on the old code (176/300 instances) and pass on the new.
- **Verification**: Full monorepo suite green — API 903 (was 899), worker 9 (was 6); typecheck clean; lint 0 errors. A code-review subagent confirmed delta↔segment consistency, loop bounds, tail handling, edge cases, and API/worker parity; its one nit (scope the "never worse" guarantee to symmetric matrices) was applied to both docstrings.

### 2026-06-11T05:20 UTC — Maintenance Pass: CVE Sweep, CLI Tests, Real README
- **Security**: `npm audit fix` cleared all 17 advisories (2 critical: shell-quote, vitest; 5 high incl. fast-uri path traversal in Fastify's URI stack, react-router DoS; moderates incl. ws, hono, qs, turbo). Lockfile-only change; full build/test/typecheck/lint verified green after.
- **CLI tests**: packages/cli had `test: echo 'not yet configured'`. Added vitest (same config conventions as siblings) + 38 tests: output.ts (table sizing/padding, JSON mode, stderr/stdout split), config.ts (~/.homer round-trip with homedir mocked to a tmp dir, malformed JSON / missing apiKey → null, clearConfig idempotent), api.ts (URL normalization, Bearer header, Content-Type rules, error-message extraction with statusText fallback, empty body → undefined), mcp/util.ts (result builders, safeGetApi returns error instead of process.exit).
- **README**: replaced the stock Vite-template README with a real front door (monorepo table, stack, quickstart, dev commands, contributor notes linking ARCHITECTURE.md). Root `typecheck` script added (`turbo typecheck`); README documents `npm run typecheck`.
- **Dev env DX**: api + worker `dev` scripts now pass `--env-file-if-exists=../../.env`, so `cp .env.example .env` is the whole local setup. Shell env still wins (Node env-file precedence), PM2 prod loading untouched. Needs Node 22.9+ (documented in README). Verified by booting the API with a copied .env — passed the JWT_SECRET hard requirement, proceeded to Redis connect.
- **Review-driven revert**: deliberately did NOT keep --env-file-if-exists on `db:migrate:run` — deploy.yml runs that script ON the prod server over SSH from /opt/homer-io, where the flag would change which env migrations see and assume server Node ≥22.9 (unverifiable; a failed migrate step triggers the workflow's VPS-reboot fallback).
- **Gotcha**: output.test.ts stripAnsi regex originally embedded a literal invisible ESC byte — 4 of 9 review agents misread it as a missing-ESC bug. Rewritten as visible `\x1b` + `chalk.level = 0` for deterministic assertions under FORCE_COLOR/CI.
- 5 commits. Suite: 899 api + 38 cli + 6 worker + web/shared all green. claudepad trimmed to the 20-summary cap (28 older entries moved to oldpad.md per CLAUDE.md rule).

### 2026-04-23T01:30 UTC — Telematics Adapter Foundation (Samsara)
- **Why**: Homer customers in furniture/grocery/cannabis often already run Samsara/Motive/Geotab on their trucks. Building a connector lets them keep that hardware instead of installing the Homer driver app on every phone, and gives dispatchers engine-level data the phone can't provide.
- **Scope of the port from the Catena takehome**: we kept the *adapter pattern* + the Plaid-style connect flow and dropped everything else (HOS/DVIR compliance, broker/freight-matching, 30+ small-ELD adapters, the enterprise sync engine). This is v1 for last-mile, not a Catena clone.
- **Schema** (`0011_add_telematics.sql` + 6 Drizzle files): `telematics_connections` (OAuth material AES-GCM-encrypted), `telematics_external_vehicles` (mirror with `mappedVehicleId` to Homer vehicles), `telematics_external_drivers`, `telematics_positions` (rolling buffer, 30-day retention), `telematics_sync_state` (per-(connection, domain) cursors), `location_conflicts` (diagnostic only). `location_history.source` + `vehicles.last_lat/lng/at/source` columns added. One shared `location_source` enum used by all three.
- **Adapter interface** (`lib/telematics/adapter.ts`): `TelematicsAdapter` declares `startAuth/completeAuth/refreshAuth/probe + listVehicles/listDrivers/fetchLatestPositions + registerWebhook/verifyWebhook/parseWebhook`. Everything except the first three is optional — adapter declares capabilities.
- **Samsara** (`lib/telematics/samsara.ts`): OAuth with Basic-auth client credentials, single-use refresh tokens, 1hr access-token TTL. Webhooks use Samsara's `v1=<hmac>` scheme with a base64-decoded secret and `v1:<timestamp>:<body>` message — secret is configured at the marketplace-app level via `SAMSARA_WEBHOOK_SIGNING_SECRET`, so `registerWebhook` is a no-op that returns the shared secret. Motive + Geotab are P3 (env slots in place).
- **Service + routes** (`modules/telematics/`): signed OAuth state (HMAC over JSON payload — no DB table for in-flight sessions, 15min TTL). Routes: `POST /connect/:provider/start|complete`, `GET/DELETE /connections/:id`, `GET /connections/:id/vehicles` (auto-suggest by normalized plate match), `POST /connections/:id/vehicles/link`, `POST /webhooks/:provider/:connectionId` (signature-only auth, no JWT). All management routes `denyDemo`.
- **Position merge** (`modules/tracking/service.ts`): new `mergePosition({source, tenantId, driverId?, vehicleId?, lat, lng, recordedAt, ...})`. Writes `location_history` with source, `drivers.current*` only if `recordedAt > existing.lastLocationAt` (freshness guard), `vehicles.last*` when `vehicleId` given. Conflict detection: if a different source wrote within 60s and the two positions are >500m apart, write a `location_conflicts` row and prefer driver_app. `updateDriverLocation` now delegates — driver-app POST /api/tracking/location path unchanged.
- **Poll scheduler** (`modules/telematics/scheduler.ts`): single-instance via PG advisory lock (`pg_try_advisory_lock(0x74656c656d6174)`). 60s interval, 1min cadence for positions / 15min for vehicles. On any 401 from the provider, refresh → retry once → mark `pending_reauth` if refresh returns null.
- **Entity-resolution simplification vs Catena**: Catena's resolver does VIN + multi-attribute driver scoring. Homer v1 does manual-with-auto-suggest on normalized plate match only (user confirmed in planning). `vehicles.licensePlate` → normalized uppercase alphanumerics → suggested in linker UI; dispatcher confirms per row.
- **UI**: `TelematicsSection` inside `IntegrationsTab` (Samsara/Motive/Geotab cards, status badge, last-sync line). `TelematicsDetailPanel` modal (status, account, counts, Reconnect button wired to the `pending_reauth` state). `TelematicsVehicleLinker` modal (two-column: upstream vehicles ↔ Homer vehicles dropdown, save-per-row, green suggestion hint when plate match found). `/settings/telematics/callback` page consumes OAuth code+state from session storage and POSTs `/complete`. `DriverMarker` shows a dashed outer ring for telematics-sourced markers + `via Samsara/Motive/Geotab` chip in popup.
- **Feature gate**: `fleet_tracking` added to `FEATURE_KEYS` (category `integrations`). Telematics section visible when tenant has `fleet_tracking` enabled OR industry is `furniture`/`grocery` (per user: "toggle for all").
- **Config**: `SAMSARA_CLIENT_ID/SECRET/WEBHOOK_SIGNING_SECRET` + motive/geotab placeholder env vars. All empty-string default so local dev without the provider app configured doesn't crash startup.
- **Tests**: 12 Samsara adapter tests (HMAC pass/tampered-body/wrong-secret/no-prefix/no-headers + parse position/ignore other events/malformed JSON + OAuth URL builder + completeAuth + refreshAuth), 6 service helpers (signState roundtrip + tamper/expired/garbage rejection, haversineMeters SF→Oakland sanity). 896 API tests + 200 web tests passing, zero regressions. Test suite had to stub `bullmq` because importing telematics service transitively pulls geofencing→customer-notifications→Redis.
- **Wet-test status**: NOT YET — wet test requires Samsara OAuth app credentials (`SAMSARA_CLIENT_ID`/`SECRET`) which aren't in the current deploy. User needs to register a Samsara marketplace app, set env vars, then connect a sandbox tenant. Webhook URL for Samsara app config: `https://homer.io/api/telematics/webhooks/samsara/{connectionId}` (connectionId is per-tenant; Samsara's marketplace-app model shares one callback URL + secret, routes by org in payload).


### 2026-04-20T06:30 UTC — Audit-Cycle Medium/Low Fixes
- **M7 (polling backoff)**: new `usePollingWithBackoff` hook with exponential backoff (30s → 60s → 120s → 240s → 300s cap). Applied to `NotificationCenter`, `HealthDashboard`, and `useDashboard`. Pure `startBackoffPoller`/`computeBackoffDelay` helpers testable with `vi.useFakeTimers()`.
- **M10 (CSP)**: `<meta http-equiv="Content-Security-Policy">` on `packages/web/index.html`. Policy allows Google OAuth, MapTiler, Carto tiles, fonts, data:/blob:/https: images (for MinIO presigned URLs), wss: for Socket.IO; denies `unsafe-eval`, sets `frame-ancestors 'none'`, `object-src 'none'`. Caddyfile comment updated noting header can be set at the edge too.
- **M11 (legacy demo preservation)**: CI step in `.github/workflows/deploy.yml` verifies `legacy/demo-site/{index.html,main.jsx,App.jsx,vite.config.js}` exist. Does NOT build — per memory, that dir is preserved for reference only.
- **L3 (style injection)**: `ensureKeyframeStyle(id, css)` helper replaces module-scoped `let injected = false` booleans in `VoiceMicButton` and `AIChatPanel`. Uses `document.getElementById` for idempotency, works under HMR/double-mount/SSR.
- **L7**: correcting the earlier "619 tests passing" figure — current measured counts: shared=82, api=628/645 (17 pre-existing failures unrelated to this change), worker=4, web=163/165 (2 pre-existing address-hash failures unrelated to this change). Monorepo total passing: 877, with 29 new tests added in this session.
- **Tests added**: `usePollingWithBackoff.test.ts` (fake-timer integration, 13 cases), `ensureKeyframeStyle.test.ts` (idempotency + SSR smoke, 4 cases), `csp.test.ts` (policy structural checks, 12 cases).


### 2026-03-22T15:30 UTC — Voice-First Dispatcher Interface + Undo System
- **Voice endpoints**: POST /api/ai/transcribe (Whisper STT) + POST /api/ai/tts (OpenAI TTS) — thin wrappers, agent loop unchanged
- **Undo system**: Redis-backed mutation snapshots (15min TTL), 6 of 10 mutations undoable, SSE `undoable` event, /api/ai/undo endpoint
- **Frontend**: useVoice hook (MediaRecorder + transcription + TTS playback), VoiceMicButton (pulsing red), UndoDropdown, speaker toggle in header
- **Security**: snapshotId UUID validation, TTS schema validation, media stream cleanup, Permissions-Policy microphone=(self)
- **Config**: VOICE_WHISPER_MODEL, VOICE_TTS_MODEL, VOICE_TTS_VOICE env vars
- **Rate limit**: AI endpoints bumped to 20/min (was 5) to accommodate voice interactions (3 requests per voice command)
- @fastify/multipart added for audio upload, scoped to AI routes only
- 17 new tests, 58 total nlops+voice passing


### 2026-03-22T14:00 UTC — Wet Test + UI Fixes
- **Deploy fix**: `/opt/homer-io/site` was stale copy, symlinked to `packages/web/dist` for automatic freshness
- **Vertical landing cards**: increased width (380→440px), font size (12.5→13.5px), padding, description length (80→120 chars)
- **Register page**: added "Setting up for [industry] delivery" amber badge when arriving from vertical landing with ?industry= param
- **SW caching**: confirmed `registerType: 'autoUpdate'` is correct, stale dir was the real issue
- All 8 public pages verified rendering correctly


### 2026-03-22T13:30 UTC — Vertical Landing Pages + Onboarding Polish + Pricing
- **6 vertical landing pages**: /cannabis, /florist, /pharmacy, /restaurant, /grocery, /furniture — each with industry-specific hero, pain points, feature highlights, competitor comparison, compliance section, pricing notes
- **VerticalLanding.tsx** shared component (19KB) + vertical-content.ts (21KB) — parameterized by industry
- **Register pre-selection**: ?industry= query param auto-sets industry on registration
- **Onboarding polish**: industry-specific welcome subtitles, prominent "Load sample data" button after industry selection
- **Dashboard quick actions**: industry-relevant next steps for new users (3 action cards per industry)
- **Pricing page**: standalone /pricing with 4-tier cards, annual/monthly toggle, feature matrix, industry pricing notes, metered extras, FAQ accordion
- **Demo notification templates**: industry-specific SMS/email templates seeded per vertical
- 619 tests passing, no new backend changes needed


### 2026-03-22T09:40 UTC — Restaurant + Grocery + Furniture Verticals
- **Restaurant**: speed_priority feature, Square + Toast POS connectors (industryGate='restaurant'), RestaurantTab settings (delivery window, batch size), high-priority demo data
- **Grocery**: substitution_management + temperature_zones features, substitutionAllowed/substitutionNotes/temperatureZone on orders, GroceryTab settings (substitution policy, temp monitoring), demo data with frozen/refrigerated/ambient zones
- **Furniture**: crew_assignment + assembly_tracking + haul_away + wide_time_windows features, crewSize/assemblyRequired/haulAway on orders, FurnitureTab settings (crew size, assembly, haul-away, window size), demo data with 70% 2-person crews, 50% assembly, 30% haul-away
- **9 POS connectors total**: Shopify, WooCommerce, Dutchie, FTD, Teleflora, PioneerRx, Square, Toast, METRC
- Migration: 0009_add_remaining_verticals.sql
- 14 new tests, 619 total passing


### 2026-03-22T05:15 UTC — Cross-Industry Feature Toggle System
- **Feature decoupling**: 16 features (id_verification, manifests, cold_chain, gift_messages, etc.) now independent of industry
- **Industry sets defaults**: selecting cannabis auto-enables 7 features, florist enables 4, pharmacy enables 7
- **Any tenant can enable any feature**: medical cannabis pharmacy can enable both cannabis + pharmacy features
- **enabledFeatures array** in tenant.settings JSONB, exposed via auth response + org settings
- **All gating swapped**: backend (orders, routes, driver) and mobile (stop detail) now check features not industry
- **Features panel** in Organization settings tab with toggles by category (Compliance, Operations, CX)
- **Integrations filtering** updated: connectors show when industry matches OR relevant features enabled
- No migration needed (JSONB settings), no new tests (existing tests unchanged)


### 2026-03-22T04:30 UTC — Pharmacy Delivery Vertical
- **HIPAA-safe driver view**: driver sees hipaaSafeNotes (no medication names), PHI stripped for pharmacy tenants
- **Controlled substances**: isControlledSubstance + controlledSchedule (II-V) on orders, auto-require signature
- **Cold chain**: isColdChain flag, coldChainConfirmed toggle in POD confirm step
- **Patient verification**: patientDob + patientDobVerified (lighter than cannabis ID scan)
- **Prescriber info**: prescriberName + prescriberNpi on orders
- **PioneerRx connector**: maps prescriptions to HIPAA-safe orders (RX numbers as barcodes, no med names in driver notes)
- **PharmacyTab settings**: license, NPI, HIPAA toggles, controlled substance behavior, cold chain alerts
- **Order form**: pharmacy-specific fields (controlled substance, cold chain, patient DOB, prescriber)
- **Demo data**: 20% controlled, 15% cold chain, all with prescriber + patient DOB
- Migration: 0008_add_pharmacy_support.sql
- 12 new tests, 605 total passing


### 2026-03-22T04:05 UTC — Florist Delivery Vertical Phase 2
- **Temp driver quick-onboard**: driver_invites table, token generation, public redeem endpoint, creates user+driver with minimal info, auto-expires
- **FTD connector**: EcommerceConnector for FTD Mercury wire orders, maps sender/recipient/gift message, industryGate='florist'
- **Teleflora connector**: Same pattern for Teleflora WinDSR, maps sender/recipient/gift, industryGate='florist'
- Public invite routes registered separately (no auth needed for redemption)
- Migration: 0007_add_driver_invites.sql
- 10 new tests, 593 total passing


### 2026-03-22T03:25 UTC — Florist Delivery Vertical Phase 1
- **Two-customer model**: sender fields (name/email/phone) + gift message + isGift on orders
- **Dual notifications**: recipientType on templates (recipient/sender/both), 3 new variables: senderName, giftMessage, deliveryPhotoUrl
- **Public tracking enhanced**: gift message card, delivery photo display, sender name for gift orders
- **Florist settings tab**: auto-photo toggle, default gift delivery, default instructions
- **Order form**: "This is a gift" toggle with conditional sender/gift fields
- **Demo data**: 80% of florist orders now have structured sender/gift data
- **Industry auto-defaults**: florist orders auto-require delivery photo
- Migration: 0006_add_florist_support.sql
- 14 new tests, 583 total passing


### 2026-03-22T02:20 UTC — Cannabis Delivery Vertical Phase 3
- **Jurisdiction data**: 27 delivery-legal states (14 rec + 13 medical), 58 CA counties + 55 cities from DCC
- **Delivery zones**: radius (miles) + zip code list validation on order creation, zone-check endpoint
- **Dutchie connector**: EcommerceConnector implementation mapping cannabis products with tracking tags, THC/CBD, strain, medical/rec, cash-on-delivery
- **METRC connector**: SeedToSaleConnector with state-specific API bases (16 states), credential validation, package listing, transfer creation
- **CannabisTab extended**: jurisdiction dropdown, radius slider, zip code textarea
- Integration index updated: Dutchie registered with industryGate='cannabis'
- 15 new tests, 569 total passing


### 2026-03-22T02:05 UTC — Cannabis Delivery Vertical Phase 2
- **Driver Kits**: New table + CRUD — track what product is loaded in the vehicle per route
- **Kit lifecycle**: loading → loaded → in_transit → reconciling → reconciled, with state guards
- **Reconciliation**: Compare loaded vs returned items, auto-detect discrepancies
- **Cash-on-Delivery**: cashAmount/cashCollected/paymentMethod columns on orders, collection endpoint
- **Delivery Limits**: checkDeliveryLimits() sums route value/weight against cannabis settings, warnings on route creation
- **Mobile**: DriverKitView, CashCollection, ReconciliationFlow components
- **Web**: KitManagement table + ReconciliationView side-by-side, added to CannabisTab
- Migration: 0005_add_cannabis_kits.sql
- 12 new tests, 554 total passing


### 2026-03-22T01:45 UTC — Cannabis Delivery Vertical Phase 1
- **ID Verification**: New IDVerification.tsx mobile component (camera capture, DOB picker, age check, name match)
- **POD Flow Extended**: PODFlow.tsx now conditionally adds id_verification step for cannabis tenants
- **Delivery Manifests**: New table, service (CRUD + PDF generation), routes (/api/cannabis/*)
- **Manifest PDF**: Legal-grade PDFKit document with products, tracking tags, recipients, signature lines
- **Cannabis Settings**: CannabisTab.tsx in web settings (license, state, limits, toggles, manifest prefix)
- **Industry gating**: requireIndustry('cannabis') middleware gates all cannabis routes
- **Order hook**: Cannabis tenants auto-get requiresSignature=true, requiresPhoto=true on every order
- **Auth response**: industry field now included in user response for client-side feature gating
- **Migration**: 0004_add_cannabis_support.sql (POD ID columns + delivery_manifests table)
- **21 new tests**, 542 total passing, TypeScript clean



## Key Findings

- **Design token system**: `app.css` defines CSS custom properties (`:root`). `theme.ts` exports `C` (colors as `var(--xxx)`) and `F` (fonts as `var(--xxx)`) plus `alpha(color, opacity)` helper. Accent: golden amber (#F59E0B). Display: Cabinet Grotesk. Body: Inter (dashboard) / Satoshi (auth, driver). Old blue (#5BA4F5) only in legacy `landing/` components.
- **Legacy demo**: Original prototype moved to `legacy/demo-site/` (deprecated). The product demo is now at `/demo` in the main SPA (`packages/web`).
- **Fastify reply helpers**: Using `@fastify/sensible` for `reply.unauthorized()`, `reply.forbidden()`, etc.
- **Drizzle numeric columns**: Stored as strings in JS, need explicit parsing when doing math.
- **Package versions**: React 19.2.4, Vite 8.0.0, Fastify 5.3.0, Drizzle 0.44.0, Zod 3.25.0.
- **Socket.IO pattern**: `initSocketIO(httpServer)` called after `app.listen()`, `getIO()` accessor, `broadcastToTenant(tenantId, event, data)` helper. JWT verified via fast-jwt in auth-middleware.
- **LiveMap export**: Uses `export default function LiveMap()` (default export, not named).
- **api client**: Has get/post/put/patch/delete methods. `put` added in Phase 2 for settings.
- **Route state machine**: draft→planned, planned→in_progress, in_progress→completed, any→cancelled. Validated in transitionRouteStatus().
- **Notification flow**: createNotification() inserts DB + broadcasts Socket.IO `notification:new` via broadcastToTenant.
- **Driver routes**: Under /driver with DriverLayout (no sidebar, bottom tabs). Protected by same ProtectedRoute wrapper.
- **POD upload pattern**: Base64 JSON body (not multipart), stored in MinIO at homer-pod/{tenantId}/{orderId}/.
- **api.upload()**: Added to api client for FormData uploads (sets no Content-Type, lets browser handle multipart boundary).
- **Customer notification triggers**: Wired into transitionRouteStatus (driver_en_route for all orders) and completeStop (delivered/failed). Uses .catch(() => {}) to not block main flow.
- **Webhook triggers**: Same pattern — enqueueWebhook called in transitionRouteStatus and completeStop with .catch(() => {}).
- **Drizzle enum type casting**: When querying pgEnum columns with string variables, need `as any` cast to satisfy TypeScript.
- **Worker queues**: Now 11 total: route-optimization(2), notifications(5), analytics(1), customer-notifications(5), webhook-delivery(10), billing-usage(1), integration-sync(3), report-generation(2), route-template(1), data-export(1), data-retention(1).
- **Billing middleware**: requireActiveSubscription skips /api/auth, /api/public, /api/billing, /health, /stripe. No sub record → allow (new tenant). 402 blocks mutations for expired/canceled.
- **Geofencing pattern**: On every location update, fire-and-forget checkGeofences(). Redis key geofence:triggered:{routeId}:{orderId} with 24h TTL prevents duplicate notifications.
- **ETA calculation**: haversine × 1.3 road correction ÷ vehicle speed × 60 + dwell time. Recalculated on every driver location update, broadcast as route:eta Socket.IO event.
- **Carbon tracking**: Computed on-the-fly from routes.totalDistance + vehicles.fuelType/type. No new DB table needed.
- **Credential encryption**: AES-256-GCM with INTEGRATION_ENCRYPTION_KEY env var, key hashed to 32 bytes via SHA-256.
- **Settings page tabs**: Now 9 total (Organization, Team, Billing, Integrations, API Keys, Notifications, Webhooks, Privacy, Health).
- **Account lockout**: 5 failed login attempts → lockedUntil set 15min ahead. 423 status returned. Reset on successful login.
- **Email utility**: sendTransactionalEmail in lib/email.ts (SendGrid REST API). Used by auth, team, GDPR modules.
- **Structured logger**: packages/worker/src/lib/logger.ts — JSON output, no pino dependency. child() for contextual fields.
- **GDPR deletion**: 30-day grace period, confirmation token hashed with SHA-256. Deletion cascades via tenant FK onDelete.
- **Dispatch board**: Kanban with HTML5 DnD. Unassigned column + per-driver columns. Drop triggers batch assign API.
- **Messages**: Cursor-based pagination (createdAt cursor). Socket.IO broadcast on message:new. Sidebar badge polls unread count.
- **Stripe webhook**: Registered at root level (outside /api prefix) with raw body parser for HMAC verification.
- **Worker queues**: Now 12 total (added delivery-learning with concurrency 3).
- **Address normalization**: Building-level grouping strips apt/suite/unit/floor/# designators. SHA-256 hash of `building|city|state|zip|country` for dedup.
- **Learning trigger pattern**: Same fire-and-forget `.catch()` as webhooks/notifications in completeStop(). Worker duplicates address normalization + haversine to avoid cross-package imports.
- **Drizzle migration**: drizzle-kit generate fails with ESM .js imports (CJS resolution error). Workaround: hand-written SQL in drizzle/ with manual journal entries. Push via `drizzle-kit push --force` on deploy.
- **NLOps tool count**: 22 tools (12 query, 10 mutation). Intelligence tools added in Phase 6D.
- **Worker queues**: Now 13 total (added migration with concurrency 1 in 7B).
- **Migration connector duplication**: Worker duplicates all platform fetch logic (same pattern as integration-sync.ts duplicating Shopify/WooCommerce). API package has connector classes; worker has standalone functions. Both must stay in sync.
- **db:migrate:run env trap**: deploy.yml runs `npm run -w @homer-io/api db:migrate:run` on the prod server with NO env file loaded — migrate.ts falls back to its hardcoded localhost default DATABASE_URL. Do not add --env-file flags to that script without verifying server Node ≥22.9 and intending the env change; a failed migrate step triggers the workflow's VPS-reboot fallback.
- **Learned avg service time = denormalized cache of `delivery_metrics`**: `address_intelligence.avg_service_time_seconds` is recomputed (`recomputeAddressAvgServiceTime`, worker delivery-learning.ts) as `avg(delivery_metrics.service_time_seconds)` over the address after each delivery — NOT an incremental running average. Do NOT reintroduce an incremental update keyed off `successful_deliveries`/`total_deliveries`: service-time samples are recorded for failed deliveries (GPS arrival) and skipped for successes with no breadcrumb, so those counters are the wrong divisor. The recompute is exact and self-heals drift; it relies on `delivery_metrics` being one-row-per-delivery and never pruned (data-retention.ts does not touch it).
- **FOLLOW-UP (pre-existing, needs migration) — `delivery_metrics(order_id)` has no unique constraint**: the delivery-learning worker dedups via SELECT-then-INSERT (no DB constraint), so two concurrent jobs for the same order (worker concurrency 3) could both insert, double-counting the order's sample in the avg recompute AND double-incrementing `address_intelligence` counters (the counter increment in `upsertAddressIntelligence` also runs *before* the dedup check). Normally unreachable: BullMQ won't run the same job id twice and the API completeStop guard (422 on already-delivered/failed) blocks duplicate enqueues. Proper fix: unique index on `delivery_metrics(tenant_id, order_id)` + `INSERT … ON CONFLICT DO NOTHING`, and move the counter upsert behind the dedup — but the constraint-add must first dedupe any existing rows, and the repo's migration path is unreliable (hand-written SQL + `drizzle-kit push --force`, journal stale past 0009), so this was deferred rather than bundled into the avg fix.
- **Integration order-import dedup invariant**: order import (API `modules/integrations/service.ts` `syncOrders` AND its worker twin `workers/integration-sync.ts` — keep both in sync) dedups against `integration_orders` via the shared `collectImportedExternalIds` helper, which counts an external order as "already imported" ONLY when its row has a non-null `orderId`. Rows with `orderId = null` are prior FAILED attempts and MUST be retried — do NOT revert to keying dedup off mere row existence (that silently lost any order that ever failed once). The success-path `integration_orders` insert is an `onConflictDoUpdate` on `uq_integration_order_dedup(connectionId, externalOrderId)` so a retried order flips its failed row to synced instead of throwing; the order + mapping inserts run inside one `db.transaction` (no orphan order on partial failure); and `existingIds.add(extId)` after each success dedups duplicates within a single fetch batch (orders.externalId is NOT unique).
