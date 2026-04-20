# Claudepad — Session Memory

## Session Summaries

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

### 2026-03-20T23:30 UTC — Mobile App Phase 0+1: Expo/React Native Foundation + Driver Core
- **New package**: `packages/mobile/` — Expo SDK 55, React Native 0.83, Expo Router (file-based navigation)
- **Phase 0 (Foundation)**: app.config.ts (io.homer.mobile), metro.config.js (monorepo watchFolders), eas.json (3 build profiles), turbo.json (mobile tasks), theme.ts (raw hex tokens from web CSS vars), MMKV v4 Zustand adapter
- **Phase 1 (Auth + Driver Core)**: API client with expo-secure-store JWT storage + token refresh, auth store (MMKV persist + secure tokens), driver store (identical shape to web), role-based auth gating in root layout
- **Screens**: Login, Register, Driver Route (FlatList + StopCards + progress bar), Stop Detail (recipient info + navigate + POD/failure actions), Driver Profile (status toggle + break + sign out)
- **Components**: StopCard, NavigateButton (platform-aware Maps link), PhotoCapture (expo-image-picker camera), SignaturePad (react-native-signature-canvas), PODFlow (4-step wizard), DeliveryFailureFlow (reason selector + photo + notes), Badge, LoadingSpinner, EmptyState
- **Navigation**: 3 route groups — (auth) stack, (driver) bottom tabs (Route/Map/Profile), (dispatch) bottom tabs (Dashboard/Orders/Map/AI/More) with sub-screens
- **40 source files** total. TypeScript compiles clean. iOS + Android bundles export successfully (2.8MB).
- **Next**: Phase 2 (background GPS, push notifications, biometric, offline POD, live map)

### 2026-03-20T22:00 UTC — Fluid Responsive (Smooth Resize)
- **Approach**: Replaced hard-snap breakpoints with fluid CSS inspired by Vercel/Linear patterns.
- **CSS tokens**: Added `--page-pad`, `--page-heading`, `--card-gap`, `--section-gap` as `clamp()` values in `:root`.
- **KPI grids**: Switched from `repeat(4, 1fr)` + breakpoint overrides to `auto-fit/minmax(min(180px, 100%), 1fr)` — cards flow naturally as viewport changes. Same for 6-column, intelligence, and migration grids.
- **Two-column layouts**: Analytics chart grid uses `clamp(240px, 30vw, 320px)` for heatmap; Route builder uses `clamp(300px, 35vw, 400px)` for controls. Both stack below 900px.
- **Typography**: Page heading `h2` elements scale via `var(--page-heading)` = `clamp(18px, 2.5vw, 24px)`.
- **Spacing**: Main content padding uses `var(--page-pad)` = `clamp(16px, 3vw, 32px)`. Gap uses `var(--card-gap)`.
- **Fixed widths removed**: DispatchBoard columns (was 280px → `clamp(220px, 25vw, 280px)`), LiveMap feed minWidth (was 240px → 0), Dispatch AI panel (was 480px → `min(480px, 100%)`).
- **Form grids**: `auto-fit/minmax` instead of hard 1fr at 640px.
- **10 files modified**. Deployed as commit a631ade.

### 2026-03-20T21:15 UTC — Comprehensive Mobile Responsive Support
- **Scope**: All pages and layouts now work at mobile/tablet widths (375px–1024px).
- **CSS foundation** (`app.css`): Added 13 new responsive media query blocks for: analytics chart grids, route builder grid, route detail header/stops, form grids in modals, bulk action bar, intelligence widget KPIs, migration page, dispatch board, 6-column KPI variant, demo main layout, search rows, driver leaderboard rows, public tracking.
- **DemoDashboardLayout**: Full mobile sidebar support — hamburger menu toggle, slide-out drawer with backdrop, `useIsMobile` hook, body scroll lock, Escape key close, route-change auto-close. Matches DashboardLayout's mobile behavior.
- **17 files modified**: app.css + DemoDashboardLayout + Analytics + RouteBuilder + RouteDetail + Orders + Vehicles + Migration + LiveMap + DispatchBoard + IntelligenceWidget + DemoDashboard + DemoAnalytics + DemoOrders + DemoRoutes + DemoFleet + PublicTracking.
- **Pattern**: Added CSS class names to inline-styled elements, then media queries override `grid-template-columns`, `flex-direction`, etc. with `!important`.
- **Breakpoints used**: 1024px (tablet), 768px (mobile sidebar/layout), 640px (form grids, small cards), 480px (notifications, auth), 374px (extra-small).
- **Deployed**: Commit c56ed66, deployed via SSH to ovh2. All CSS/JS verified on production.

### 2026-03-20T18:00 UTC — Per-User Demo Tenants with Live AI Copilot
- **Backend**: New `POST /api/auth/demo-session` anonymous endpoint — creates real tenant (isDemo=true) + visitor user, seeds location-aware data, returns JWT. Rate limited 5/min/IP, 1hr Redis cache to prevent refresh spam.
- **Geocoding**: New `packages/api/src/lib/geocoding.ts` — MapTiler reverse geocoding with 60-city fallback, `generateLocalAddresses()` generates 24 addresses within 15km of visitor's coordinates.
- **Location-aware seeding**: `seedDemoOrg()` now accepts `{ lat, lng }` options. Orders, routes, and analytics use generated local addresses instead of Bay Area hardcodes. Route names are city-relative ("Morning Denver Route" etc).
- **Demo metering skip**: AI routes check `tenant.isDemo` (cached 60s) and skip `recordMeteredUsage`. Rate limits still apply. Notification tool no-ops for demo tenants (no real SMS/email).
- **Frontend provisioning**: `useDemoStore` gains `tenantStatus: 'static'|'provisioning'|'ready'|'failed'` + `provisionTenant()`. DemoDashboardLayout kicks off background provisioning on mount, reads lat/lng from URL search params.
- **Copilot in demo**: `<AIChatPanel />` added to DemoDashboardLayout. Shows "Setting up your demo..." spinner during provisioning, demo-specific welcome message when ready, fallback message on failure. Input disabled until tenant ready.
- **Landing page**: "See how it works" / "Try the demo" links now pass `?lat=X&lng=Y` from `useHeroGeolocation`.
- **Cleanup**: Data retention worker deletes demo tenants older than 7 days (FK cascades handle all child records).
- **Files**: 2 new (geocoding.ts, demo-session.ts), 10 modified. All 4 packages type-check + build clean.

### 2026-03-20T12:00 UTC — Live Map Revival
- **Demo Live Map fully client-driven**: Replaced random-drift simulation with route-following interpolation along pre-computed Bay Area highway waypoints (I-280/US-101/I-80/CA-24/I-880).
- **New file**: `demo-route-paths.ts` — 2 routes (Morning SF 46 waypoints, Midday East Bay 44 waypoints), 11 stops total, `advanceAlongPath()` pure helper.
- **Demo driver locations**: Added lat/lng/heading/speed to DemoDriver interface. Tracking store fallback populates from static data when API returns empty in demo mode.
- **Map center**: Bay Area [37.65, -122.20] zoom 10 for demo, NYC for non-demo.
- **Route visualization**: Dashed amber polyline for full route, solid green for completed portion, circle markers for stops (green=done, amber=next, dim=future), progress panel overlay showing route name/driver/stops count/progress bar.
- **Delivery events**: Seeds 6 initial events from completed stops. Fires new events as drivers pass stops during simulation (90% delivered, 10% failed).
- **Smooth animation**: CSS transition on marker divs (`transition: transform 0.9s linear`).
- **Demo sidebar**: Added Live Map nav item to DemoDashboardLayout, `/demo/live` route in App.tsx.
- **Bug fix**: Switched from `useAuthStore(s => s.user?.isDemo)` to `useDemoStore(s => s.isDemoMode)` — the auth store's `onRehydrateStorage` was clearing demo-token and stopping the simulation.
- **Tests**: 13 new tests (advanceAlongPath logic, route data validation, Bay Area bounds). 28 data tests pass total.
- 3 commits. Deployed and wet-tested via browser automation. GIF: homer-live-map-demo.gif.

### 2026-03-20T11:30 UTC — Ship-Blockers & Polish Batch (9 Items)
- Fixed 9 ship-blocker/polish/growth items using 5 parallel Opus agents + direct fixes.
- **#1 AI Copilot missing key**: `AINotConfiguredError` class in providers.ts, 503 + `AI_NOT_CONFIGURED` code on API routes, friendly `AINotConfiguredCard` component with "Go to Settings" link in AIChatPanel. 6 tests.
- **#2 Onboarding notifications skippable**: "Configure later" button on step 4/5, `POST /onboarding/skip-step` + `GET /onboarding/provider-status` endpoints, skipped steps tracked in tenant settings JSONB. SMS/email providers now return explicit `success: false` when unconfigured. 11 tests.
- **#3 Old landing components**: Confirmed clean — no unstaged changes.
- **#4 Hero map crossfade**: Already fixed (styledata + 2.5s fallback). Added 5 unit tests for ready-signal logic.
- **#5 Mobile responsive**: 19 files modified. Hamburger menu + sidebar overlay on mobile. Touch targets 44px. Tables horizontal-scroll with fade hint. AI panel full-screen overlay. Modals bottom-sheet. KPI grids responsive (4→2→1 col). Landing page hero/pricing/footer all mobile-friendly. 40 tests.
- **#6 SEO/OG tags**: Added og:image, og:url, twitter:card meta tags. Generated 1200x630 OG image (dark theme, amber accents, "Talk to your fleet." headline) via canvas + browser automation.
- **#7 Public demo mode**: Client-side `/demo` route with static Bay Area data (12 orders, 5 drivers, 3 routes). `guardDemoWrite()` blocks mutations in orders/fleet/routes/settings stores. DemoBanner with signup CTA. "See how it works" → `/demo`, "Talk to us" → "Try the demo". 39 tests.
- **#8 Stripe/.env.example**: Added all Stripe (6 keys), Twilio (3), SendGrid (2) env vars to .env.example.
- **#9 OSRM health**: Deploy workflow now attempts `docker start osrm-homer` if health check fails, with actionable error message.
- **Bug fix**: Pre-existing `pTotal` undefined in analytics insights engine (line 615). Fixed: `const pTotal = prevStats.delivered + prevStats.failed`.
- **Test fix**: NLOps tool count 22→25 (onboarding agent added 3 tools).
- 457 tests pass. Full build clean.

### 2026-03-20T10:30 UTC — Analytics Overhaul: Three-Zone Dashboard
- **Complete analytics page rewrite** with three zones: "The Glance" (KPIs), "The Story" (charts + insights), "The Detail" (tabbed deep-dive).
- **Zone A**: 6 animated KPI cards (count-up animation, inline sparklines, period-over-period deltas). Copilot prompt bar with 4 suggestion pills wired to NLOps store.
- **Zone B**: Enhanced trend chart (4 series incl. on-time rate on 2nd Y axis, brush selector, anomaly dots, "vs Previous" toggle). Delivery heatmap (7×24 day/hour CSS grid, amber intensity, hover tooltips). Auto-generated insights strip (scrollable cards with "Ask HOMER" CTAs).
- **Zone C**: Tabbed detail — Drivers (medal badges, sparklines, efficiency scores, expandable rows, fleet-avg comparison), Routes (duration comparison bars, summary stats), Delivery Outcomes (stacked bar, failure donut, time-window compliance gauge).
- **Backend**: 7 new endpoints under /analytics/enhanced/ + /heatmap + /insights + /outcomes + /compare. Insights engine with 6 pattern detectors (day-of-week failure anomaly, peak hour, driver outlier, failure category concentration, week-over-week regression, capacity utilization).
- **Demo data**: seedDemoAnalytics() generates 90 days of historical data (~750 orders, ~130 routes) with deliberate patterns (Tuesday failure spike, peak hours, driver performance profiles, growth ramp).
- **Copilot tools**: 3 new NLOps tools (get_analytics_deep, compare_periods, get_delivery_outcomes) for conversational analytics queries.
- **New files**: 10 components (AnimatedKPICard, Sparkline, DeliveryHeatmap, EnhancedTrendChart, InsightCard, InsightsStrip, AnalyticsPromptBar, DriverPerformanceTable, RouteAnalytics, DeliveryOutcomes). 4 CSS keyframe animations.
- **Bug fixes during deploy**: Date→ISO string for raw SQL params, enum→text cast for COALESCE, unicode emoji escape sequences.
- 5 commits. Deployed and wet-tested via browser automation.

### 2026-03-20T05:30 UTC — V2 Auth: Google OAuth + Org Resolution
- Implemented Google sign-in/sign-up with ID token flow (`google-auth-library` + `@react-oauth/google`).
- **Google OAuth flow**: GoogleLogin component → ID token → backend `verifyIdToken` with audience check → 3-case resolution (existing by googleId, email match auto-link, new user with org options).
- **Org resolution**: New users choose: join existing org (domain auto-join), start fresh, or explore demo. OrgChoicePage.tsx.
- **Domain auto-join**: `orgDomain` + `autoJoinEnabled` on tenants. Generic domains (gmail, yahoo, etc.) excluded. First from domain = owner, subsequent = dispatcher.
- **Demo seeding**: 24 Bay Area locations, 4 vehicles, 5 drivers, 15-20 orders with today's timestamps, 3 routes (completed/in_progress/draft).
- **Email linking**: Work email verification with 24h expiry, SQL LIKE lookup (no full table scan), auto-join matching org on verify.
- **DB changes**: `google_id` (unique) + `avatar_url` on users. `org_domain` + `auto_join_enabled` + `is_demo` on tenants. Index on org_domain.
- **Frontend**: GoogleSignInButton (Google's rendered button), updated Login/Register with Google button + "or" divider, OrgChoice page, auth store with `pendingGoogleUser` (excluded from localStorage via `partialize`), App wrapped in GoogleOAuthProvider.
- **Security**: ID token flow (not implicit) with audience verification. No access tokens stored in localStorage.
- **Google Cloud**: Created OAuth consent screen (External) + OAuth Client ID for HOMER-io project. Authorized origins: homer.discordwell.com, app.homer.io.
- 9 backend commits + 3 frontend commits + 1 docs commit. 566 tests passing. Deployed to ovh2.
- **New files**: 10 (google-auth.ts schema, google.ts, demo-seed.ts, domain.ts, email-link.ts, 3 test files, GoogleSignInButton.tsx, OrgChoice.tsx). **Modified**: 14 files.

### 2026-03-20T00:15 UTC — Backend Aesthetic Redesign (Match Homepage)
- Unified all three surfaces (dashboard, auth, driver app) with the homepage's golden amber design system.
- **CSS Variables Migration**: Created `app.css` with `:root` custom properties for all design tokens. Updated `theme.ts` to export `var(--xxx)` references — all 97 importing components cascade automatically. Added `alpha()` helper for semi-transparent colors (replaces broken `${C.color}XX` hex alpha pattern with `rgba(var(--color-rgb), opacity)`).
- **Color shift**: Accent from electric blue (#5BA4F5) to golden amber (#F59E0B). Backgrounds from #03080F to #06090F. Text from #EEF3FC to #F1F5F9 slate palette. Borders updated. Status colors preserved (green/red/yellow/orange/purple).
- **Typography**: Display font Syne → Cabinet Grotesk. Dashboard body stays Inter. Auth/driver body → Satoshi. JetBrains Mono unchanged.
- **Nav restructure**: New fixed top nav bar with "HOMER." branding (amber dot). Sidebar now collapsible (240px ↔ 64px). DashboardLayout restructured with margin-based content offset.
- **Auth pages**: Full rewrite from inline styles to CSS classes (`.auth-page`, `.auth-card`, etc.). Removed all theme.ts imports. Satoshi font family.
- **Driver layout**: Added `.driver-app` CSS class for Satoshi font override.
- **Button color fix**: All accent-background buttons changed from `color: '#fff'` to `color: '#000'` (amber needs dark text for contrast) — 37 instances across 31 files.
- **Alpha helper migration**: ~50 components updated from `${C.color}XX` hex suffix to `alpha(C.color, decimal)`. RGB component CSS variables added (`--accent-rgb`, `--red-rgb`, etc.).
- **Favicon**: Updated SVG inline icon from blue to amber with new background color.
- Build passes (zero TS errors from changes). Vite build clean.

### 2026-03-19T21:30 UTC — Geolocation Hero Map for Landing Page
- Added personalized hero map: detects visitor's geolocation, shows MapLibre GL map of their area with animated driver dots on real local roads. Falls back to existing Bay Area SVG if denied/timeout.
- **Architecture**: `useHeroGeolocation` (one-shot, 3s timeout) → `React.lazy` loads MapLibre chunk → `queryRenderedFeatures` extracts road geometries → `DriverAnimator` canvas overlay with 10 dots (7 amber, 3 green) → 800ms CSS crossfade. Zero bundle penalty on denial.
- **New files** (all in `landing-v2/`): HeroMap.tsx (orchestrator), MapLibreHeroMap.tsx (lazy-loaded map), useHeroGeolocation.ts, maplibreStyle.ts (dark command-center style), driverAnimator.ts (road extraction + canvas animation), heroMap.css (crossfade + grid + range rings), 2 test files (19 tests).
- **Modified**: HomePage.tsx (BayAreaMap → HeroMap), package.json (+maplibre-gl).
- **Code review fixes applied**: C1 (cached pathLength per dot), C2 (onReady ref pattern), I1 (console.warn on missing API key), I4 (exported pure functions, tests import from real module), I5 (debounced resize listener), S1 (null-safe parentElement checks).
- **Needs**: VITE_MAPTILER_KEY env var on ovh2 for MapLibre to activate (free tier, 100K loads/mo). Without it, SVG fallback works perfectly.
- Build clean, 19 tests pass.

### 2026-03-19T19:19 UTC — Fresh Homepage: Bay Area Command Center
- Replaced entire landing page with new design. Did NOT reference old landing components.
- **Design**: Dark "dispatch command center" aesthetic. Cabinet Grotesk + Satoshi fonts (Fontshare CDN). Amber/gold (#F59E0B) accent on deep navy (#06090F). No shared design tokens with old homepage.
- **Hero**: Full-viewport Bay Area SVG map as background. 10 animated driver dots (amber=active, green=delivered) moving along real highway paths (US-101, I-80, I-880, I-280, I-580, CA-92). Golden Gate + Bay Bridge highlighted. City labels (SF, Oakland, Berkeley, SFO, San Jose, Palo Alto, Fremont, Richmond, Daly City). Grid overlay + range rings for command-center feel. Auto-playing NLOps chat preview (loops every 15s) showing Oakland pickup assignment flow.
- **Sections**: Status strip ("LIVE | 12 drivers active | 47 deliveries today | 98.2% on-time | Bay Area, CA"), NLOps demo (Marcus sick scenario with route splitting), Address Intelligence card (1847 Broadway Oakland, 47 deliveries, 91% success, gate code, parking, dog warning, risk 12/100), 3x2 feature grid (SVG icons), pricing cards (4 tiers $0-$699, Growth highlighted), final CTA, footer.
- **Scroll reveal**: IntersectionObserver-based fade-in (threshold 0.12, 0.7s transition).
- **Files**: 3 new in `packages/web/src/components/landing-v2/` (BayAreaMap.tsx, HomePage.tsx, home.css ~460 LOC). Updated Landing.tsx (rewired to new component), index.html (added Fontshare font links). Old landing components in `landing/` now unused but preserved.
- **Deploy**: Built locally, rsync'd dist to ovh2:/opt/homer-io/site/. Live at homer.discordwell.com. Hard refresh needed to bypass PWA service worker cache.
- Build: zero TS errors. 1672 lines added.

### 2026-03-17T03:15 UTC — ESLint TypeScript Coverage Fix
- ESLint config only matched `**/*.{js,jsx}` — all TypeScript source files were invisible to lint.
- Installed `typescript-eslint`, expanded file pattern to `**/*.{ts,tsx}`, swapped `no-unused-vars` for `@typescript-eslint/no-unused-vars`.
- Fixed all 73 lint issues (40 errors, 33 warnings) across ~40 files:
  - 12 unused vars (removed imports, prefixed with underscore)
  - 14 `no-explicit-any` (replaced with `unknown`, `Record<string, unknown>`, or proper types)
  - 5 refs-during-render (LiveFleetMap: added mapReady state; RouteMap: moved ref assignment to useEffect; useSocket: replaced ref return with state)
  - 4 setState-in-effect (CarbonDashboard/PODViewer: derived loading from settled state; useGeoLocation: init from render; VerifyEmail: init from token presence)
  - 1 impure function in render (ReportDownload: moved Date.now() into callback)
  - 4 react-refresh/only-export-components (eslint-disable comments for utility co-exports)
  - 33 exhaustive-deps (eslint-disable for stable zustand actions; added deps where appropriate)
- Build passes, 20 tests pass, lint clean (0 errors, 0 warnings).

### 2026-03-16T19:45 UTC — Landing Page: "The Split Screen"
- Created `/` landing page (720 LOC) with 8 sections: sticky nav, hero with split-panel mockup (SVG fleet map + AI chat), "See everything" dispatch board, "One click. Faster routes" before/after SVG, "Ask it anything" NLOps reveal, interactive pricing calculator + plan cards, migration callout, final CTA + footer.
- **Routing**: Added `/` route to App.tsx, `CatchAllRedirect` component (auth → /dashboard, unauth → /).
- **Pricing calculator**: Driver slider (5-50) + competitor dropdown (Tookan/Onfleet/OptimoRoute/Circuit/Other). Auto-selects best HOMER plan (Standard/Growth/Scale) based on driver count. Shows savings in green.
- **Plan cards**: Free/Standard/Growth/Scale with monthly/annual toggle. "Unlimited drivers" prominent. Growth has POPULAR badge.
- **Animations**: Hero float (2px, 3s), driver dot pulse (2s), section fade-in-up via IntersectionObserver, calculator number transitions.
- **Responsive**: useWidth() hook with breakpoints at <900px (hero stack), <768px (feature stack), <640px (full-width cards).
- **Deploy**: CI deploy failed (missing OVH2_HOST secret). SSH to ovh2 also failed (port 22 closed). Pushed to main; deploy pending SSH restoration.
- **Wet test (local)**: All 8 sections render. Nav opacity on scroll. Calculator interactive (slider/dropdown/savings). Annual toggle updates prices. Start Free → /register, Login → /login, catchall → /. Demo link points to homer.discordwell.com.
- Build: zero TS errors. 720 LOC new file + 8 LOC App.tsx change.

### 2026-03-16T19:00 UTC — Phase 7C: API-Based Migration Connectors
- Implemented 5 API connectors (Tookan, Onfleet, OptimoRoute, GetSwift, Circuit). SpeedyRoute stays CSV-only.
- **Connector interface**: ExternalMigrationOrder, ExternalDriver, ExternalVehicle types. MigrationConnector interface with validateCredentials, fetchOrders/Drivers/Vehicles, getCounts.
- **5 connectors**: Each ~100-150 LOC. Rate-limited pagination, AbortSignal.timeout(30s). Tookan (POST body api_key), Onfleet (Basic auth, cursor pagination, has vehicles), OptimoRoute (query param key, day-by-day), GetSwift (api-key header), Circuit (Bearer token, plans→stops).
- **Registry**: getMigrationConnector(), apiMigrationPlatforms, getMigrationPlatformInfo() with supportsApi/supportsVehicles/credentialHint.
- **API**: POST /validate (test credentials + counts), GET /platforms (capabilities). validateMigrationCredentials service fn.
- **Worker**: API branch added — decrypt apiKey → fetchFromPlatformApi() → same batch insert pipeline. Duplicated fetch logic (same pattern as integration-sync.ts). Added crypto helpers.
- **Frontend**: API/CSV mode toggle, API key input, date range, test connection button with validation counts. Review step adapts to mode. Fixed cancel setting currentJob=null (now re-fetches). History table shows imported/total.
- **Shared**: validateMigrationCredentialsSchema, migrationPlatformInfoSchema added.
- **Tests**: 22 new connector tests (mock fetch, mapping, pagination, empty responses, registry). 3 new validation schema tests. 4 new validation service tests. 43 migration tests pass.
- **7B bug fixes**: CSS minmax missing px, cancel missing tenant filter, completedAt on failure, test mock path.
- Build: zero TS errors. 425/426 tests pass (1 pre-existing onboarding timeout).

### 2026-03-16T17:30 UTC — Phase 7B: Migration API, Worker & UI
- Implemented CSV-based migration pipeline: API endpoints, BullMQ worker, and 5-step wizard UI.
- **Shared schema**: Added `migrationCsvDataSchema` (orders max 5000, drivers max 500, vehicles max 200) and `csvData` field to `createMigrationJobSchema`.
- **API module** (`packages/api/src/modules/migration/`): 5 routes (POST create, GET list paginated, GET by id, POST cancel, DELETE). Admin-only. 10MB body limit. Service encrypts apiKey, strips sensitive fields from response, enqueues BullMQ job.
- **Worker** (`packages/worker/src/workers/migration.ts`): Batch CSV processor (50 rows/batch). Processes orders (resolveCsvAliases), drivers, vehicles. Progress tracking per-entity. Cancellation check between batches. Error log capped at 100 entries. Fatal errors set status=failed.
- **Frontend**: Zustand store (migration.ts), MigrationPage with 5-step wizard (select platform → upload CSVs with papaparse → review summary → progress with polling → complete with results). Migration history table. FileDropZone with drag-and-drop. Platform cards for 6 competitors.
- **Routing**: `/dashboard/migrate` route in App.tsx, "Migrate" nav item in Sidebar (before Settings).
- **Tests**: 14 new tests covering schema validation (csvData limits, platform enum, API-key path) and service logic (apiKey encryption, cancel rejects wrong status, delete rejects active, BullMQ enqueue, activity logging).
- **Worker queues**: 12→13 (added migration with concurrency 1).
- Build: zero TS errors. 14/14 migration tests pass. 82/82 shared tests pass.

### 2026-03-16T15:20 UTC — Phase 6E: Frontend Intelligence Polish
- Surfaced intelligence data in the UI across 5 pages/components. 3 new files, 5 modified.
- **RiskBadge component**: Reusable risk indicator pill (0-100 score, color-coded: green/yellow/orange/red). Click expands to show risk factors popover. `riskSummary()` helper for aggregate display.
- **Route Detail**: Fetches `/intelligence/risk/{routeId}` for planned/in_progress routes. Risk badges next to each stop, route-level risk summary banner above stops list.
- **Dispatch Preview**: Fetches risk scores for each proposed route. RiskBadge on each route card, high-risk count in header with warning indicator.
- **IntelligenceWidget**: Dashboard widget fetching `/intelligence/insights`. 3 KPI cards (addresses learned, deliveries tracked, avg service time) + top failure addresses list with fail rate and reason.
- **Orders — Address Intelligence Panel**: Click order row → fetches intelligence by browser-hashed address. Shows delivery count, success rate, avg service time, failures, access instructions, parking notes, failure reasons.
- **Address hash utility**: Browser-compatible `hashAddressBrowser()` using Web Crypto API (`crypto.subtle.digest('SHA-256')`). Produces identical output to server-side `hashAddress`. Uses shared `normalizeAddress` (pure string ops).
- **Copilot tool labels**: Added 3 missing intelligence tool labels to AIChatPanel.
- **Tests**: 10 new tests (5 address hash parity, 5 riskSummary logic). All pass. Build clean.

### 2026-03-16T11:25 UTC — NLOps Deferred Fixes (8 of 8)
- Implemented all 8 deferred code review fixes from the NLOps review in a single pass.
- **H4/M10 — Redis pending actions**: Replaced in-memory `Map<string, PendingAction>` with Redis-backed `cacheGet`/`cacheSet`/`cacheDelete`. Key: `nlops:pending:{actionId}`, TTL 300s. Removes `setTimeout` cleanup and per-process heap pressure.
- **H5 — Per-tenant rate limiting**: Redis-backed concurrency (max 3) + rate (max 20/min) guard in `/api/ai/ops`. Keys: `nlops:active:{tenantId}` (120s TTL), `nlops:rate:{tenantId}:{minute}` (60s TTL). Returns 429 with clear message.
- **M13 — Frontend AbortController**: Added `abortController` field to NLOps store. `send()`/`confirm()` abort previous before creating new. Signal passed to `fetch()`. AbortError silently swallowed. `clear()` also aborts.
- **M14 — Spinner dedup**: Moved `@keyframes spin` from inline `<style>` in Spinner to module-level injection with boolean guard. No duplicate `<style>` tags.
- **L15 — Dead eventType**: Removed unused `eventType` variable from SSE parsing (type read from JSON payload).
- **L17 — resetProvider()**: Added one-line `resetProvider()` export to providers.ts for test setup.
- **L18 — Pagination awareness**: Added `showing` count alongside `total` in `getOperationalSummary` routes and pendingOrders return.
- **Tests**: 5 new tests (resetProvider, key format conventions). 380 total pass (36 files). Build clean.

### 2026-03-16T10:15 UTC — Phase 6 Wet Tests + Deploy Fixes
- **Deploy fixes**: PM2 ecosystem config was overriding PORT=3000 while .env said PORT=3030 and Caddy proxies to 3030. Fixed to fork mode + `--env-file`. Worker location_history schema had non-existent `created_at` column (table uses `timestamp`). Data-retention worker used generic `.createdAt` on location_history. Fixed both.
- **Learning Pipeline E2E (PASS)**: Created 4 deliveries to same building (100 Broadway, Denver) across Fl 5, Apt 12, Suite 3, Unit 8. All mapped to single address hash — building-level grouping works. Running stats: 4 total, 2 success, 2 failed, 50% failure rate. Failure reasons tracked per-address. Auto-classification: "Nobody home" → not_home, "Gate locked" → access_denied.
- **Intelligence API (PASS)**: `/insights` returns correct aggregate stats. `/address/:hash` validates hash format (400 on invalid), returns 404 for unknown. `/risk/:routeId` returns risk score 45 (high_failure_rate +30, previous_failure +15).
- **UI Wet Test (PASS)**: Login → Dashboard (7 orders, 50% rate) → Orders (statuses correct) → Routes (progress bars, auto-dispatch). Copilot chat opened but no response (no ANTHROPIC_API_KEY in server .env — expected).
- **Hard Wet Tests (ALL PASS)**: SQL injection in hash → 400 blocked. Double-complete stop → 422 idempotent. Risk for fake route → empty array. Tenant isolation → only own data. XSS in address → stored raw, React escapes on render.
- GIF: homer-phase6-wet-test.gif (20 frames)

### 2026-03-16T10:30 UTC — Phase 6: The Dispatcher Brain (Learning Layer + Intelligence)
- Implemented Phases 6A, 6C, 6D of the "Dispatcher Brain" pivot — the system that learns from every delivery.
- **Phase 6A — Learning Layer Foundation**:
  - New `address_intelligence` table: per-address brain memory with running stats (avg service time, success/failure rates), hourly delivery patterns, LLM-extracted access instructions/parking notes/customer preferences, common failure reasons.
  - New `delivery_metrics` table: per-delivery actual vs estimated (arrival times, service time, distance, ETA error), linked to address intelligence.
  - New `failure_category` enum + column on orders table (not_home, wrong_address, access_denied, refused, damaged, business_closed, weather, vehicle_issue, other).
  - `packages/api/src/lib/address.ts`: Address normalization (building-level grouping, strips apt/suite/unit) + SHA-256 hashing.
  - `packages/worker/src/workers/delivery-learning.ts`: BullMQ worker (concurrency: 3). On every completed stop: records delivery metrics from GPS breadcrumbs, upserts address intelligence running averages, keyword-based failure classification, async LLM POD note extraction (Claude Haiku for access instructions, parking, preferences).
  - Trigger: `enqueueDeliveryLearning()` wired into `completeStop()` as fire-and-forget (same pattern as webhooks/notifications).
  - SQL migration: `drizzle/0001_add_learning_layer.sql` (idempotent with IF NOT EXISTS).
- **Phase 6C — Intelligence Integration**:
  - `lib/intelligence/risk-scorer.ts`: Scores deliveries 0-100 based on address failure rate (+30), bad delivery hour (+20), driver failed here (+15), tight time window (+10), no history (+5).
  - `modules/intelligence/`: 3 API endpoints: `GET /api/intelligence/address/:hash`, `GET /api/intelligence/risk/:routeId`, `GET /api/intelligence/insights` (dashboard: top failure addresses, learning stats, 7-day metrics).
- **Phase 6D — Copilot Upgrade**:
  - 3 new NLOps query tools: `get_address_intelligence`, `get_intelligence_insights`, `get_route_risk`. Tool count: 19→22.
  - Fixed pre-existing nlops test failure (empty message with confirm field).
- **Files**: 8 new, 9 modified. Worker queues: 11→12. 374 tests pass (44 new). Zero TypeScript errors (excluding pre-existing providers.ts OpenAI type).

### 2026-03-16T08:00 UTC — NLOps: Natural Language Operations
- Implemented full NLOps feature: conversational fleet operations via agentic AI loop with tool calling.
- **Architecture**: User message → SSE stream → agent loop (Claude Opus 4.6 / GPT-5.4) → tool_use cycling → confirmation pause for mutations → execute on confirm.
- **Provider abstraction**: `lib/ai/providers.ts` — unified interface for Anthropic and OpenAI. Model configurable via env vars (NLOPS_PROVIDER, NLOPS_ANTHROPIC_MODEL, NLOPS_OPENAI_MODEL).
- **Tool registry**: 19 tools (9 query, 10 mutation). All tools call existing service layer directly. Zod-schema input validation. RBAC filtering by user role.
- **Risk tiers**: read (instant), mutate (inline confirm), destructive (full preview + confirm). All mutation tools have preview() functions.
- **Agent loop**: `lib/ai/agent.ts` — AsyncGenerator yielding SSE events. Max 10 iterations. In-memory pending action store for confirmation resume (5min expiry).
- **SSE endpoint**: POST /api/ai/ops. Events: thinking, tool_start, tool_result, message, confirmation, action_result, error, done. Metered per-interaction (not per-tool-call).
- **Frontend**: Replaced AIChatPanel with NLOps-aware panel. Structured messages (tool indicators, confirmation cards, action results). Toggleable full-screen ThoughtOverlay showing agent reasoning + tool chain. Zustand store consuming SSE via ReadableStream.
- **New files**: shared/schemas/nlops.ts, api/lib/ai/{providers.ts, agent.ts, tools/{types.ts, index.ts, query.ts, mutations.ts}}, web/stores/nlops.ts.
- **Modified**: config.ts (OpenAI config, nlops config), ai/routes.ts (SSE endpoint), AIChatPanel.tsx (complete rewrite), shared/index.ts, ARCHITECTURE.md.
- **Tests**: 91 new NLOps tests (schemas, tool registry, RBAC, risk levels, result summarizer). 364 total pass.
- **Deps**: openai SDK added to api package.

### 2026-03-16T06:00 UTC — Route Optimization: Replace Claude with OSRM + VRP Solver + Google Routes
- Replaced Claude-based route optimization, auto-dispatch, and ETA calculation with proper algorithmic routing.
- **New routing stack**: OSRM (self-hosted, Docker) for distance/duration matrices, TypeScript VRP solver (nearest-neighbor + 2-opt for TSP, Clarke-Wright savings for CVRPTW), Google Routes API for traffic-aware customer-facing ETAs.
- **New files**: `packages/api/src/lib/routing/` (osrm.ts, vrp-solver.ts, google-routes.ts, index.ts), `infra/osrm/` (setup-osrm.sh, refresh-osrm.sh), worker lib files (vrp-solver.ts, osrm.ts, geo.ts).
- **Modified**: routes/service.ts (optimizeRoute now uses OSRM+VRP), dispatch/service.ts (autoDispatch uses CVRPTW solver), eta/service.ts (Google→OSRM→haversine fallback chain), worker/optimization.ts (VRP solver), config.ts (OSRM_URL, GOOGLE_ROUTES_API_KEY).
- **Graceful degradation**: If OSRM is down, falls back to haversine-based distance matrix. If Google Routes fails, falls back to OSRM durations, then haversine.
- **Tests**: 28 new routing tests (VRP solver determinism, TSP correctness, capacity/priority constraints, OSRM coord flipping, Google Routes caching). 424/425 total pass (1 pre-existing nlops failure).
- Removed `@anthropic-ai/sdk` from worker package (Claude still used for AI chat in API package).
- Fixed pre-existing worker schema bug: location_history table missing driverId, lat, lng, timestamp fields.

### 2026-03-16T04:15 UTC — Pricing Restructure: Per-Order Model
- Full competitive audit completed (10+ competitors researched, market sizing, SWOT analysis).
- Pricing restructured from per-driver ($49-65/driver/mo) to per-order model inspired by Routific.
- **New tiers**: Free (100 orders/mo, $0), Standard (1K, $149), Growth (5K, $349), Scale (15K, $699), Enterprise (custom).
- **All features at every tier**. Unlimited drivers. Volume-gated only.
- **Metered at-cost**: AI optimization (10 free, $0.05/run), AI dispatch (5 free, $0.15/batch), AI chat (50 free, $0.02/msg), SMS (50 free, $0.01), email (500 free), POD storage (1GB free, $0.10/GB). Pay-as-you-go toggle.
- **Files changed**: shared/schemas/billing.ts (new plan enum, metered schemas), api/db/schema/subscriptions.ts (removed quantity, added payAsYouGoEnabled), new metered-usage.ts table, billing service.ts (complete rewrite — removed syncSeats, added metering), billing middleware (order limit enforcement on POST /api/orders), billing routes (new /pay-as-you-go + /metered-usage endpoints), config.ts (new Stripe price keys), worker/billing-usage.ts (order-based limits), fleet/service.ts (removed syncSeats calls).
- **Frontend**: PlanSelector (4 plans, per-order pricing), BillingTab (order usage bar, metered usage table, pay-as-you-go toggle), SubscriptionBanner (order limit warnings), billing store (new actions for metering).
- **Metering hooks**: AI chat, route optimization, auto-dispatch, customer notifications (SMS/email) all check/record metered usage.
- 273 tests pass (29 files). All 4 packages + demo build clean.

### 2026-03-15T23:15 UTC — Phase 5 Hardening + Full Wet Test
- Applied 7 hardening fixes from code review: rate limits on email endpoints (3/min), GDPR list pagination, batchAssignToRoute transaction, route-template worker transaction, password reset token retention cleanup (7-day), escapeHtml utility (applied to team invite), DB indexes on emailVerificationToken + refreshTokens.tokenHash.
- 267 tests pass (29 test files), 7 new tests in hardening.test.ts.
- **CI fix**: Removed `composite: true` from shared tsconfig and project references from all tsconfigs. Removed `tsc` from web build (Vite handles bundling). Added `react-is` dep. CI test job now passes green.
- **Deploy fix**: Set up full server infrastructure on ovh2 — Docker Postgres 16 + Redis 7, Node 22, PM2, Caddy reverse proxy on `homer.discordwell.com`. API on port 3030. Fixed cron-parser CJS import for Node ESM compatibility. Used `drizzle-kit push --force` for schema migration.
- **Privacy tab fix**: PrivacyTab crashed (`r.find is not a function`) because GDPR list endpoints now return `{ items, total, ... }` but frontend expected arrays. Fixed to extract `.items`.
- **Wet test results** (browser automation against deployed site):
  - Flow 1 Auth: PASS — register, dashboard loads, forgot-password page renders
  - Flow 2 Onboarding: PASS — 5-step wizard, "Go" navigates, progress tracks (green checkmark on vehicle after creation)
  - Flow 3 Fleet Data: PASS — vehicle created, appears in table with correct data
  - Flow 5 Dispatch: PASS — kanban renders with Unassigned column, Manual/AI tabs
  - Flow 6 Settings 9 Tabs: PASS — all 9 tabs visible (Organization, Team, Billing, Integrations, API Keys, Notifications, Webhooks, Privacy, Health)
  - Flow 7 GDPR Privacy: PASS (after fix) — data export, retention policies (90/365/180/90), delete account
  - Flow 8 Health: PASS — DB 2ms, Redis 8ms, memory, uptime, all 11 queue depths
  - Flow 9 Hard Tests: XSS PASS (`<script>alert(1)</script>` rendered as plain text), orders page functional
  - GIF recorded: homer-wet-test-flows.gif (48 frames)

### 2026-03-15T14:15 UTC — Phase 5 "Production Grade" Implementation
- Implemented full Phase 5 (auth hardening, stub fixes, onboarding, operational features, GDPR, observability) using foundation-first + 5 parallel agents.
- **Foundation**: 4 new DB schemas (password_reset_tokens, route_templates, messages, data_export/deletion_requests). Column additions to users (emailVerified, failedLoginAttempts, lockedUntil) and tenants (onboardingCompletedAt, onboardingStep). 6 new Zod schemas. Config: app.frontendUrl. Dep: cron-parser.
- **Auth Hardening (A)**: Account lockout (5 fails → 15min lock, 423 status). Email verification (token on register, verify/resend endpoints). Password reset (SHA-256 hashed token, 1hr expiry, single-use). Team invite emails. 3 new pages (ForgotPassword, ResetPassword, VerifyEmail). Login "Forgot password?" link. 22 tests.
- **Stub/Wiring Fixes (B)**: Notification worker sends real emails. Public tracking uses calculateRouteETAs (was hardcoded 30min). syncSeats on driver create/delete. 402 handling + BillingBlockedModal. 5 cron schedulers. Activity logging on 6 service files. Report worker queries real data. 8 tests.
- **Onboarding (C)**: 5-step wizard (vehicle→driver→order→route→notifications). Dismissible banner in DashboardLayout. Skip/complete actions. Time window validation (start < end). Route overlap warnings. 4 tests.
- **Operational Features (D)**: Route templates with cron-parser recurring generation + worker. Batch ops (status update, route assign, fleet import — max 100). Driver-dispatcher messaging (cursor-based, Socket.IO broadcast, unread badge). Dispatch board (HTML5 DnD kanban). 48 tests.
- **GDPR + Observability (E)**: Data export (JSON, BullMQ, 7-day expiry). Account deletion (30-day grace, email confirmation). Data retention (4 policies, daily cleanup worker). Health dashboard (DB/Redis latency, queue depths, memory). Structured JSON logger across 11 workers. Privacy + Health settings tabs. 20 tests.
- **Integration wiring**: server.ts (5 new modules), App.tsx (4 new routes), Sidebar (Dispatch + Messages with unread badge), Settings (9 tabs), DashboardLayout (OnboardingWizard + BillingBlockedModal), worker/index.ts (11 queues + 5 cron schedules).
- 260 tests pass (28 test files). All 4 packages + demo build clean. ~50 new files, ~45 modified.

### 2026-03-15T07:00 UTC — Phase 4 Code Review + Security/Performance Fixes
- Performed thorough code review of all Phase 4 changes (billing, integrations, operational intelligence, infrastructure).
- Found 5 CRITICAL, 8 HIGH, 8 MEDIUM, 4 LOW issues across security, performance, logic, and code quality.
- **CRITICAL fixes applied**:
  - C1: Inbound integration webhook signature verification was optional — now mandatory (reject if no signature).
  - C2: Webhook handler was re-fetching entire external order catalog (SSRF/DoS risk) — now maps directly from webhook body.
  - C3: Webhook callback URL pointed to frontend domain instead of API domain — fixed with env-aware URL selection.
- **HIGH fixes applied**:
  - H1: Billing enforcement middleware was hitting DB on every request — now cached in Redis (60s TTL) with invalidation on webhook events.
  - H4: Trial with null trialEndsAt treated as expired — now allows access when no expiry set.
  - H5: Portal endpoint returnUrl not validated — added Zod schema.
  - H6: Invoices endpoint page/limit unbounded — added Zod schema with max(100).
  - H7: ETA calculation used (0,0) as fallback for missing coords — now returns null for stops without valid coordinates, ETA schema updated to allow nullable.
  - H8: Report date parameters unvalidated — added Zod regex + date validation.
- All 219 tests pass (158 API + 61 shared). All 4 packages + demo build clean.

### 2026-03-15T05:30 UTC — Phase 4 "Launch Ready" Implementation
- Implemented full Phase 4 (billing, integrations, operational intelligence, infrastructure) using foundation-first + 4 parallel agents.
- **Stream A — Billing**: Stripe SDK integration (checkout sessions, customer portal, seat sync, webhook handler at /stripe/webhook). Billing enforcement middleware (trialing/active/past_due/402). 6 billing API endpoints. Frontend: BillingTab (plan card + invoice table), PlanSelector (3-column comparison modal), SubscriptionBanner (trial/past_due/expired warnings in DashboardLayout). Zustand billing store. Billing-usage worker for daily snapshots.
- **Stream B — Integrations**: Generic EcommerceConnector pattern. Shopify connector (REST API, webhook subscriptions for orders/create/updated/cancelled). WooCommerce connector (REST API v3, consumer key auth). AES-256-GCM credential encryption (lib/integrations/crypto.ts). 9 integration API endpoints + inbound webhook receiver. Frontend: IntegrationsTab (platform cards), IntegrationConnectForm (platform-specific fields + test button), IntegrationDetailPanel. Zustand integrations store. Integration-sync worker (concurrency 3).
- **Stream C — Operational Intelligence**: Haversine distance + road correction ETA (lib/geo.ts). ETA service (calculateRouteETAs, recalculateFromDriverPosition) with vehicle-specific speeds/dwell times. Geofencing service (100m auto-arrival detection, Redis dedup with 24h TTL, triggers delivery_approaching notification + Socket.IO event). Carbon tracking (emission factors by fuel type, zero for EVs/bikes). Carbon routes (GET /api/analytics/carbon). Tracking service updated with fire-and-forget geofence + ETA recalculation. Customer notification ETA hardcode replaced with real calculation.
- **Stream D — Infrastructure**: Redis cache wrapper (homer: prefix, graceful error handling). PostgreSQL RLS (current_tenant_id() function, withTenant helper). Drizzle migration runner (db:migrate:run script). PDF report generator (pdfkit: daily summary, driver performance, route efficiency). 3 report download endpoints (Content-Type: application/pdf). Report scheduler (BullMQ repeatable jobs). Frontend: CarbonDashboard (KPIs + per-driver bar chart + EV savings), ReportDownload dropdown, EtaBadge component.
- **Foundation**: 5 new DB schemas (subscriptions, invoices, usage_records, integration_connections, integration_orders). 5 new shared Zod schemas (billing, integrations, eta, carbon, reports). Config extended (stripe, integrations). Database indexes on all 22 tables. PWA completion (vite-plugin-pwa with Workbox, manifest, apple meta tags, service worker).
- **Integration wiring**: server.ts (6 new route modules + billing webhook + billing enforcement middleware). Settings page (7 tabs: +Billing, +Integrations). DashboardLayout (+SubscriptionBanner). Analytics page (+CarbonDashboard, +ReportDownload). Worker (8 queues: +billing-usage, +integration-sync, +report-generation).
- 3 new npm deps (stripe, pdfkit, vite-plugin-pwa). 219 tests pass (158 API + 61 shared). All packages + demo build clean. PWA service worker generated.

### 2026-03-14T03:30 UTC — Phase 3 "The Last Mile" Implementation
- Implemented full Phase 3 using 4 parallel agents (same foundation-first strategy as Phase 2).
- **Driver PWA (P1)**: Driver API module (current-route, upcoming-routes, status toggle), DriverLayout with BottomTabBar, 4 driver pages (DriverRoute, DriverStopDetail, DriverMap, DriverProfile), driver Zustand store, useGeoLocation hook (10s location posting), PWA manifest. Mobile-first with 44px touch targets.
- **Proof of Delivery (P2)**: POD API module (upload via base64→MinIO, create/read), SignaturePad (canvas touch drawing), PhotoCapture (camera input, max 4), PODFlow (4-step: photo→signature→notes→confirm), DeliveryFailureFlow, PODViewer modal for dispatchers.
- **Customer Notifications (P3)**: Notification templates API (CRUD + test), provider abstraction (Twilio SMS via REST, SendGrid email via REST — graceful degradation without keys), customer-notification BullMQ worker, trigger points in route service (driver_en_route on route start, delivered/failed on stop completion), frontend (NotificationsTab, NotificationTemplateEditor with variable picker + preview, CustomerNotificationLog).
- **AI Auto-Dispatch (P4)**: Dispatch API (auto-dispatch + confirm), Claude prompt with full order/driver/vehicle context, creates draft routes then transitions to planned on confirm. Frontend: AutoDispatchPanel on Routes page, DispatchPreview with accept/reject per route.
- **Webhooks (P5)**: Webhook API (CRUD + test + delivery log), webhook helper with wildcard matching (order.*), HMAC-SHA256 signed delivery worker with exponential backoff (30s→4h, 5 attempts), 14 event types, trigger points in route service. Frontend: WebhooksTab, WebhookEndpointForm (event multi-select), WebhookDeliveryLog.
- 5 new DB schemas, 4 new shared Zod schemas, ~20 new frontend components, 2 new stores, 1 new hook, 5 new API modules, 2 new workers, 5 new test files.
- Settings page now has 5 tabs (Organization, Team, API Keys, Notifications, Webhooks).
- 187 tests pass (126 API + 61 shared). All 4 packages + demo build clean.

### 2026-03-14T01:15 UTC — Phase 2 Production-Ready Implementation
- Implemented full Phase 2 using 4 parallel agents + shared foundation strategy.
- **Real-time**: Socket.IO server on /fleet namespace with JWT auth, tenant room isolation. Tracking module (POST location, GET drivers, GET route progress). Route state machine (draft→planned→in_progress→completed), delivery completion flow with auto-transition + notifications. Frontend: LiveFleetMap with animated DriverMarkers, DeliveryEventFeed, LiveMap page (primary dispatcher view).
- **Settings/Team/Notifications**: Org settings API (timezone, units, branding), team management (invite/role/deactivate), API key management (create/list/revoke with hio_ prefix). Auth logout. Notifications API (CRUD + unread count). Frontend: Settings page with 3 tabs, NotificationCenter bell icon with dropdown + 30s polling.
- **Analytics**: 5 analytics endpoints (overview, drivers, routes, trends, CSV export) with date_trunc bucketing. Frontend: AnalyticsPage with recharts TrendChart (3 gradient areas), DriverLeaderboard, RouteEfficiencyCard, time range selector.
- **Public tracking**: GET /api/public/track/:orderId (no auth, privacy-filtered). Frontend: PublicTracking standalone page with StatusTimeline + TrackingMap.
- **Workers**: BullMQ workers implemented (optimization via Claude API, notification insertion, analytics aggregation) with proper DB connections.
- **Hardening**: Swagger/OpenAPI at /api/docs, per-endpoint rate limiting (AI 5/min, tracking 60/min, public 30/min), HTML meta/OG tags + SVG favicon, activity logging helper.
- **Integration**: Wired App.tsx (4 new routes + public tracking), Sidebar (Live Map with pulse, Analytics, Settings), DashboardLayout (NotificationCenter header).
- 4 new DB schemas, 4 new shared Zod schemas, 30+ new components, 9 new stores/hooks, 12 new API modules.
- New deps: recharts, socket.io-client (web); drizzle-orm, postgres, @anthropic-ai/sdk, ioredis (worker).
- 143 tests pass (82 API + 61 shared). All 4 packages + demo build clean.

### 2026-03-14T00:00 UTC — Phase 1 MVP Implementation
- Implemented full Phase 1: 18 shared components (Badge, Pill, Bar, KPICard, FormField, SelectField, Modal, DataTable, EmptyState, Toast, LoadingSpinner, ConfirmDialog, Sidebar, DashboardLayout, AIChatPanel, RouteMap, AddressSearch, CsvImportWizard).
- Backend: Dashboard stats endpoint, AI chat endpoint (Claude API), route optimization with Claude, enhanced query filters (search/date/sort for orders, status/search for drivers). Registered dashboard + AI modules in server.ts.
- Frontend: Nested routing under DashboardLayout, 7 pages (Dashboard with KPIs, Vehicles CRUD, Drivers CRUD with status filters, Orders CRUD with CSV import, Routes list, RouteBuilder with Leaflet map, RouteDetail with AI optimize).
- 4 Zustand stores (fleet, orders, routes, chat), useDashboard hook with 60s polling.
- Fixed requireRole double-auth (Phase 0 cleanup).
- New deps: leaflet, papaparse, @anthropic-ai/sdk.
- All packages build clean. Demo preserved. 30+ tests pass.

### 2026-03-13T UTC — Phase 0 Foundation Build
- Implemented full Phase 0: Turborepo monorepo, Fastify API, Drizzle/Postgres schema, shared Zod schemas, auth module (JWT + refresh tokens + argon2), fleet/orders/routes CRUD, web frontend (login/register/dashboard), BullMQ worker skeleton, CI/CD pipeline, Caddy config, ARCHITECTURE.md.
- Demo (src/App.jsx) preserved — builds independently via `npm run build:demo`.
- All packages type-check clean. Shared package builds successfully.

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
