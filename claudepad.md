# Claudepad — Session Memory

## Session Summaries

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


### 2026-03-21T23:50 UTC — Email-Gated Demo Sessions
- **Abuse prevention**: Demo sessions now require email address (was zero-auth `{}`)
- **Backend**: email field in schema with `.transform(toLowerCase)`, disposable domain blocklist (~80 domains), email-based dedup (Redis 7d TTL + DB slow path), replaces IP-based 1hr dedup
- **Frontend**: `DemoEmailGate.tsx` full-screen overlay, provisioning on email submit (no more background provisioning), 422 error handling
- **Shared**: `demoSessionSchema` exported from shared package for frontend validation
- **Tests**: 25 new tests (13 disposable-domains + 12 demo-email-gate), all 517 passing
- **Files**: 4 new (disposable-domains.ts, DemoEmailGate.tsx, 2 test files), 4 modified (demo-session.ts, routes.ts, shared auth.ts, demo store, DemoDashboardLayout)


### 2026-03-21T19:00 UTC — Industry Selection & Sample Data
- Added industry field to tenant model (8 industries: courier, restaurant, florist, pharmacy, cannabis, grocery, furniture, other)
- Created industry-specific order templates (industry-data.ts) with realistic items, notes, flags per vertical
- Industry selection is now the first onboarding step (inline card grid picker)
- Demo seed generates industry-flavored orders (today's + 90-day historical)
- Settings page has industry selector + "Load sample data" button
- Migration: 0003_add_tenant_industry.sql
- 22 new tests, 492 total passing


### 2026-03-21T17:40 UTC — Demo Privilege Escalation Fix
- **Security**: Blocked demo tenants from 37 sensitive endpoints across 10 route modules (api-keys, webhooks, team, integrations, gdpr, billing, customer-notifications, settings, migration, onboarding)
- **Guard**: Created reusable `checkIsDemo()` (cached 60s) and `denyDemo` preHandler in `plugins/auth.ts`, extracted from `ai/routes.ts`
- **tempPassword leak**: Removed plaintext temp password from team invite API response; frontend updated to show "invitation email sent" instead of displaying credentials
- **Tests**: 7 new tests covering checkIsDemo cache/DB behavior, denyDemo 403/passthrough/no-user, and tempPassword removal
- **All 463 existing tests + 7 new pass. TypeScript clean.**


### 2026-03-21T01:00 UTC — Mobile App Phases 0–5 Complete
- **Full mobile app** built across 5 phases: 65 source files in `packages/mobile/`
- **Phase 0**: Expo SDK 55 scaffold, metro/turbo config, theme tokens, EAS profiles
- **Phase 1**: API client (JWT refresh mutex + expo-secure-store), auth store, login/register, driver route/stop detail/POD flow/profile — all functional
- **Phase 2**: Background GPS (TaskManager), push notifications (expo-notifications + backend device_tokens + expo-server-sdk), biometric auth, offline POD queue (MMKV + NetInfo auto-sync), driver live map
- **Phase 3**: Dispatcher dashboard (KPI cards), orders list (filter+search), live fleet map (Socket.IO driver positions), routes, fleet, notifications (unread+mark read), dispatcher profile
- **Phase 4**: Messages store + DriverChat (Socket.IO live), NLOps AI copilot (full SSE streaming, tool indicators, confirmation cards), useSocket hook
- **Phase 5**: SkeletonLoader, ErrorBoundary, haptic feedback (POD success, failure error, filter selection), image compression (expo-image-manipulator 1200px/0.7), OfflineBanner, ARCHITECTURE.md updated
- **Backend additions**: device_tokens table, POST/DELETE /api/devices/(un)register, notification worker sends push via expo-server-sdk
- **Bundle sizes**: iOS 3.2MB, Android 3.3MB. TypeScript clean. All 4 packages build clean.
- **Next**: EAS project ID setup, app icons/splash, store assets, submission


---

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
