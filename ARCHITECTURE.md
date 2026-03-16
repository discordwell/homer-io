# HOMER.io Architecture

## Overview

HOMER.io is an AI-powered last-mile delivery logistics platform targeting SMB courier companies (5–50 drivers). It provides route optimization, real-time fleet tracking, order management, and an AI copilot — all with growth-friendly per-order pricing.

## System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        Caddy (Reverse Proxy + TLS)               │
├──────────────┬──────────────┬──────────────┬─────────────────────┤
│ homer.       │ app.         │ api.         │ track.              │
│ discordwell  │ homer.io     │ homer.io     │ homer.io            │
│ .com         │              │              │                     │
│ (demo)       │ (web app)    │ (API)        │ (tracking pages)    │
└──────┬───────┴──────┬───────┴──────┬───────┴─────────────────────┘
       │              │              │
       ▼              ▼              ▼
  Static Files   React SPA     Fastify API ──────► BullMQ Worker
  (dist/)        (:3001)       (:3000)              │
                                  │                  │
                    ┌─────────────┼──────────────────┤
                    ▼             ▼                   ▼
               PostgreSQL     Redis              MinIO
               + PostGIS      (cache/queue)      (file storage)
               (:5432)        (:6379)            (:9000)
```

## Monorepo Structure

```
homer-io/
├── src/App.jsx              # PRESERVED demo (never modify)
├── src/main.jsx             # PRESERVED demo entry
├── index.html               # PRESERVED demo HTML
├── packages/
│   ├── shared/              # Shared Zod schemas, types, constants
│   ├── api/                 # Fastify backend (TypeScript)
│   │   └── src/
│   │       ├── server.ts    # Entry point
│   │       ├── config.ts    # Environment config
│   │       ├── plugins/     # Auth middleware
│   │       ├── modules/     # Feature modules (auth, fleet, orders, routes, ...)
│   │       └── lib/
│   │           ├── db/      # Drizzle ORM schema + connection
│   │           ├── queue/   # BullMQ job definitions
│   │           ├── ws/      # Socket.IO setup
│   │           ├── storage/ # MinIO client
│   │           └── ai/      # Claude API wrapper
│   ├── web/                 # Product frontend (React + Vite + Zustand)
│   │   └── src/
│   │       ├── pages/       # Route-level components
│   │       ├── components/  # Shared UI components
│   │       ├── hooks/       # Custom React hooks
│   │       ├── stores/      # Zustand state stores
│   │       └── api/         # API client
│   └── worker/              # BullMQ background job processors
├── infra/                   # Caddy, PM2 configs
├── .github/workflows/       # CI/CD pipeline
└── turbo.json               # Turborepo config
```

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Runtime | Node.js 22 | Server runtime |
| API Framework | Fastify 5 | HTTP server with JSON schema validation |
| Database | PostgreSQL 16 + PostGIS | Relational data + spatial queries |
| ORM | Drizzle | Type-safe SQL with raw fallback |
| Cache/Queue | Redis 7 | Sessions, cache, BullMQ job queue |
| Real-time | Socket.IO | WebSocket for live tracking |
| File Storage | MinIO | S3-compatible object storage |
| Frontend | React 19 + Vite 8 | SPA with HMR |
| State | Zustand | Lightweight client state management |
| Validation | Zod | Shared schemas (API + client) |
| Routing | OSRM (self-hosted) | Distance matrices + road-network routing |
| VRP Solver | TypeScript (NN + 2-opt) | Route optimization + multi-vehicle dispatch |
| ETAs | Google Routes API | Traffic-aware customer-facing ETAs (cached) |
| AI (NLOps) | Claude Opus 4.6 / GPT-5.4 | Natural language fleet operations |
| AI (Legacy) | Claude Sonnet 4 | Simple chat copilot (backward compat) |
| Build | Turborepo | Monorepo task orchestration |
| Deploy | PM2 + Caddy | Process management + reverse proxy |

## Data Model

### Core Entities

- **Tenant** — Organization (multi-tenant isolation via tenant_id FK)
- **User** — Authenticated user with role (owner/admin/dispatcher/driver)
- **Vehicle** — Fleet vehicle with type, capacity, fuel info
- **Driver** — Driver profile linked to user, with status + location
- **Order** — Delivery order with full lifecycle status tracking
- **Route** — Planned/active route with assigned driver, vehicle, and orders

### Tenant Isolation

Every table has a `tenant_id` FK. All queries filter by the authenticated user's tenant. PostgreSQL RLS policies will be added for defense-in-depth.

## Data Model — Phase 2 Additions

- **Notification** — In-app notifications with type, read/unread state
- **OrgSettings** — Tenant-level config (timezone, units, branding, notification prefs)
- **ActivityLog** — Audit trail for all mutations (action, entity, metadata)
- **LocationHistory** — GPS breadcrumb trail per driver (lat/lng/speed/heading/accuracy)

## Data Model — Phase 3 Additions

- **ProofOfDelivery** — Photo/signature/GPS capture per delivered order (unique per orderId)
- **NotificationTemplate** — Customer-facing SMS/email templates with trigger-based activation
- **CustomerNotificationsLog** — Sent customer notification audit trail with provider tracking
- **WebhookEndpoint** — External HTTPS webhook subscription with event filtering and HMAC signing
- **WebhookDelivery** — Webhook delivery attempt log with retry tracking

## Data Model — Phase 4 Additions

- **Subscription** — Stripe-backed billing (plan, status, quantity/seats, trial dates, period dates)
- **Invoice** — Stripe invoice mirror (amount, status, PDF/URL links)
- **UsageRecord** — Monthly snapshot of driver/order/route counts per tenant
- **IntegrationConnection** — E-commerce platform connections (Shopify/WooCommerce) with encrypted credentials
- **IntegrationOrder** — Imported external order deduplication (unique on connection + external ID)

## API Design

RESTful API at `/api/*` with Swagger docs at `/api/docs`:

### Auth & Identity
- `POST /api/auth/register` — Create org + owner account
- `POST /api/auth/login` — JWT authentication
- `POST /api/auth/refresh` — Token refresh (rotation)
- `POST /api/auth/logout` — Delete refresh tokens
- `GET /api/auth/me` — Current user profile

### Fleet & Orders
- `CRUD /api/fleet/vehicles` — Vehicle management
- `CRUD /api/fleet/drivers` — Driver management (filterable by status/search)
- `CRUD /api/orders` — Order management (filterable by status/search/date)
- `POST /api/orders/import/csv` — CSV bulk import

### Routes & Tracking
- `CRUD /api/routes` — Route management
- `POST /api/routes/:id/optimize` — Route optimization (OSRM distance matrix + VRP solver)
- `POST /api/routes/:id/transition` — Route status state machine (draft→planned→in_progress→completed)
- `POST /api/routes/:id/stops/:orderId/complete` — Mark delivery delivered/failed
- `POST /api/tracking/location` — Driver GPS update (driver role)
- `GET /api/tracking/drivers` — All active driver positions (dispatcher role)
- `GET /api/tracking/route/:routeId/progress` — Route completion progress

### Analytics & Dashboard
- `GET /api/dashboard/stats` — Dashboard KPIs + recent orders
- `GET /api/analytics/overview` — KPIs with time range (7d/30d/90d)
- `GET /api/analytics/drivers` — Driver leaderboard
- `GET /api/analytics/routes` — Route efficiency
- `GET /api/analytics/trends` — Time-series data
- `GET /api/analytics/export/csv` — CSV export

### Settings & Team
- `GET/PUT /api/settings/organization` — Org settings (timezone, units, branding)
- `POST /api/team/invite` — Invite team member
- `GET /api/team` — List team members
- `PUT /api/team/:userId/role` — Update role
- `DELETE /api/team/:userId` — Deactivate member
- `POST /api/api-keys` — Create API key
- `GET /api/api-keys` — List API keys
- `DELETE /api/api-keys/:id` — Revoke API key

### Notifications
- `GET /api/notifications` — Paginated notifications (read/unread filter)
- `GET /api/notifications/unread-count` — Unread count
- `PATCH /api/notifications/:id/read` — Mark as read
- `POST /api/notifications/mark-all-read` — Mark all read

### Driver (Phase 3)
- `GET /api/driver/current-route` — Active route for logged-in driver
- `GET /api/driver/upcoming-routes` — Planned routes for driver
- `PATCH /api/driver/status` — Toggle online/offline/on_break

### Proof of Delivery (Phase 3)
- `POST /api/pod/upload` — Upload POD files (base64) to MinIO
- `POST /api/pod/:orderId` — Create POD record (signature, photos, GPS, notes)
- `GET /api/pod/:orderId` — Retrieve POD data

### Customer Notifications (Phase 3)
- `CRUD /api/settings/notification-templates` — SMS/email templates (admin+)
- `POST /api/settings/notification-templates/:id/test` — Send test notification
- `GET /api/notifications/customer-log` — Sent notification log (dispatcher+)

### AI Auto-Dispatch (Phase 3)
- `POST /api/dispatch/auto-dispatch` — Claude-powered route assignment (dispatcher+)
- `POST /api/dispatch/auto-dispatch/confirm` — Confirm draft routes to planned

### Webhooks (Phase 3)
- `CRUD /api/webhooks` — Webhook endpoint management (admin+)
- `POST /api/webhooks/:id/test` — Send test webhook
- `GET /api/webhooks/:id/deliveries` — Delivery history

### Billing (Phase 4 — owner role)
- `GET /api/billing/subscription` — Current plan + usage stats
- `POST /api/billing/checkout` — Create Stripe Checkout Session
- `POST /api/billing/portal` — Create Stripe Customer Portal URL
- `GET /api/billing/invoices` — Paginated invoice history
- `GET /api/billing/plans` — Available plans with features
- `POST /api/billing/change-plan` — Upgrade/downgrade plan
- `POST /stripe/webhook` — Stripe webhook receiver (root-level, HMAC verified)

### E-commerce Integrations (Phase 4 — admin role)
- `GET /api/integrations/platforms` — Available platforms
- `CRUD /api/integrations/connections` — Platform connections
- `POST /api/integrations/connections/:id/test` — Test credentials
- `POST /api/integrations/connections/:id/sync` — Trigger manual sync
- `GET /api/integrations/connections/:id/orders` — Imported orders
- `POST /api/integrations/webhook/:platform/:connectionId` — Inbound platform webhook

### ETA & Carbon (Phase 4)
- `GET /api/routes/:id/eta` — Calculate ETAs for route stops
- `GET /api/tracking/route/:routeId/eta` — ETA from tracking context
- `GET /api/analytics/carbon` — Carbon overview + per-driver breakdown

### Reports (Phase 4 — admin role)
- `GET /api/reports/daily-summary` — Download daily summary PDF
- `GET /api/reports/driver-performance` — Download driver performance PDF
- `GET /api/reports/route-efficiency` — Download route efficiency PDF

### Public (No Auth)
- `GET /api/public/track/:orderId` — Public shipment tracking
- `POST /api/ai/chat` — AI chat with fleet context
- `GET /health` — Health check

## Frontend Routes

Nested under `DashboardLayout` with sidebar navigation:

```
/login                    → LoginPage
/register                 → RegisterPage
/track/:orderId           → PublicTrackingPage (standalone, no auth)
/dashboard                → DashboardPage (KPIs + recent orders)
/dashboard/live           → LiveMapPage (real-time fleet tracking)
/dashboard/fleet/vehicles → VehiclesPage (CRUD table)
/dashboard/fleet/drivers  → DriversPage (CRUD table + status filters)
/dashboard/orders         → OrdersPage (CRUD table + CSV import)
/dashboard/routes         → RoutesPage (list with progress bars)
/dashboard/routes/new     → RouteBuilderPage (Leaflet map + stop builder)
/dashboard/routes/:id     → RouteDetailPage (map + stop list + AI optimize)
/dashboard/analytics      → AnalyticsPage (charts + leaderboard)
/dashboard/settings       → SettingsPage (org, team, billing, integrations, API keys, notifications, webhooks)
```

### Driver PWA Routes (Phase 3)
Nested under `DriverLayout` with bottom tab bar (mobile-optimized):
```
/driver                   → DriverRoutePage (active route + stop list)
/driver/stop/:routeId/:orderId → DriverStopDetailPage (POD capture flow)
/driver/map               → DriverMapPage (full-screen Leaflet map)
/driver/profile           → DriverProfilePage (status toggle, sign out)
```

## Component Library

55+ shared components in `packages/web/src/components/`:

**Core UI:** Badge, Pill, Bar, KPICard, FormField, SelectField, Modal, DataTable, EmptyState, Toast, LoadingSpinner, ConfirmDialog, EtaBadge, SubscriptionBanner
**Layout:** Sidebar, DashboardLayout, AIChatPanel, NotificationCenter, NotificationItem
**Maps:** RouteMap, AddressSearch, LiveFleetMap, DriverMarker, DeliveryEventFeed
**Analytics:** TrendChart, DriverLeaderboard, RouteEfficiencyCard, CarbonDashboard, ReportDownload
**Settings:** OrganizationTab, TeamTab, BillingTab, PlanSelector, IntegrationsTab, IntegrationConnectForm, IntegrationDetailPanel, ApiKeysTab, NotificationsTab, NotificationTemplateEditor, CustomerNotificationLog, WebhooksTab, WebhookEndpointForm, WebhookDeliveryLog
**Public Tracking:** StatusTimeline, TrackingMap
**Import:** CsvImportWizard
**Driver PWA:** DriverLayout, BottomTabBar, StopCard, NavigateButton, SignaturePad, PhotoCapture, PODFlow, DeliveryFailureFlow, PODViewer
**Dispatch:** AutoDispatchPanel, DispatchPreview

## State Management (Zustand)

- `auth.ts` — JWT tokens, user profile (persisted to localStorage)
- `fleet.ts` — Vehicles + drivers with pagination and filters
- `orders.ts` — Orders with status/search/date filters and CSV import
- `routes.ts` — Routes with CRUD and optimization
- `chat.ts` — AI chat messages and panel state
- `tracking.ts` — Live driver locations, route progress, delivery events (Socket.IO)
- `analytics.ts` — Analytics overview, driver performance, trends, route efficiency
- `settings.ts` — Org settings, team members, API keys
- `notifications.ts` — Notifications list, unread count, polling
- `driver.ts` — Driver PWA state (current route, stops, GPS, POD uploads)
- `customer-notifications.ts` — Notification templates CRUD and customer log
- `billing.ts` — Subscription status, invoices, Stripe checkout/portal
- `integrations.ts` — E-commerce connections, sync controls, platform discovery

## Real-Time Infrastructure

- **Socket.IO** server attached to Fastify's HTTP server on `/fleet` namespace
- JWT auth middleware verifies tokens from handshake
- Tenant room isolation (`tenant:{id}`) for multi-tenant broadcasts
- Events: `driver:location`, `route:status`, `delivery:event`, `notification:new`, `route:eta`, `delivery:approaching`

## Background Workers (BullMQ)

8 job queues processed by `packages/worker/`:

| Queue | Concurrency | Purpose |
|-------|-------------|---------|
| `route-optimization` | 2 | OSRM + VRP route optimization |
| `notifications` | 5 | In-app notification persistence |
| `analytics` | 1 | Aggregate analytics computation |
| `customer-notifications` | 5 | SMS (Twilio) + email (SendGrid) delivery |
| `webhook-delivery` | 10 | HMAC-signed webhook POST with exponential backoff (5 retries) |
| `billing-usage` | 1 | Daily tenant usage snapshots + limit alerts |
| `integration-sync` | 3 | E-commerce order sync (initial + periodic poll) |
| `report-generation` | 2 | PDF report generation + email delivery |

## Webhook System

- HMAC-SHA256 signed payloads (`X-Homer-Signature` header)
- 14 event types across orders, routes, deliveries, and drivers
- Wildcard subscriptions (e.g., `order.*`)
- Exponential backoff: 30s → 2m → 15m → 1h → 4h (max 5 attempts)
- Automatic endpoint health tracking (failure count, last success/failure)
- Frontend singleton client with auto-reconnect and token refresh

## Rate Limiting

| Endpoint | Limit |
|----------|-------|
| Global | 100/min |
| Auth | 10/min |
| AI | 5/min |
| Dispatch | 5/min |
| Tracking POST | 60/min |
| Public tracking | 30/min/IP |

## Authentication Flow

1. Register → creates tenant + user → returns JWT + refresh token
2. Login → validates credentials → returns JWT (15min) + refresh token (7d)
3. API requests include `Authorization: Bearer <jwt>`
4. On 401, client auto-refreshes using refresh token (rotation)
5. Roles enforced via `requireRole()` middleware

## Infrastructure Hardening (Phase 4)

- **Redis Cache** — `lib/cache.ts` wrapper with `homer:` prefix (dashboard 60s, analytics 120s, settings 300s)
- **PostgreSQL RLS** — `current_tenant_id()` function + per-table policies for defense-in-depth
- **Database Indexes** — Composite indexes on all 22 tables for tenant-scoped queries
- **Drizzle Migrations** — `db:migrate:run` script with `drizzle-kit generate` workflow
- **PWA** — Service worker via `vite-plugin-pwa` (NetworkFirst for API, CacheFirst for static)
- **Billing Enforcement** — `requireActiveSubscription` middleware (trial/active/past_due/402)
- **Credential Encryption** — AES-256-GCM for integration platform credentials

## Billing & Pricing — Per-Order Model

| | Free | Standard | Growth | Scale | Enterprise |
|---|------|----------|--------|-------|------------|
| Price | $0 | $149/mo | $349/mo | $699/mo | Custom |
| Orders/month | 100 | 1,000 | 5,000 | 15,000 | Unlimited |
| Drivers | Unlimited | Unlimited | Unlimited | Unlimited | Unlimited |
| Features | All | All | All | All | All |
| Trial | 14 days | — | — | — | — |

Annual discount: 20%. All features included at every tier — volume-gated only.

### Metered At-Cost Features (Pay-as-you-go)
Each tenant gets a free monthly quota. Beyond that, enable "Pay-as-you-go" toggle:

| Feature | Free Quota | At-Cost Rate |
|---------|-----------|-------------|
| Route Optimization | 10/mo | $0.05/run |
| Auto-Dispatch | 5/mo | $0.15/batch |
| AI Chat Messages | 50/mo | $0.02/msg |
| SMS Notifications | 50/mo | $0.01/SMS |
| Email Notifications | 500/mo | Free |
| POD Storage | 1 GB | $0.10/GB |

### Billing Architecture
- **Per-order pricing** replaces per-driver/seat-based model
- **Order limit enforcement** at middleware level (POST /api/orders blocked at plan limit)
- **Metered usage** tracked in `metered_usage` table per tenant per month
- **Pay-as-you-go toggle** per tenant — when off, usage stops at quota; when on, billed via Stripe
- **Free tier** — all features, 100 orders/month, generous metered quotas
- **Stripe integration** — flat subscription per tier (not quantity-based)

## Phase 5: Production Grade

### Auth Hardening
- **Account Lockout:** 5 failed attempts → 15-minute lock (423 status)
- **Email Verification:** Token-based verification on registration, resend endpoint
- **Password Reset:** Secure token flow (SHA-256 hashed, 1-hour expiry, single-use)
- **Team Invites:** Email with org name, temp password, login link via SendGrid

### Stub/Wiring Fixes
- **Notification Worker:** Sends real emails via SendGrid (was TODO)
- **Public Tracking ETA:** Dynamic calculation via `calculateRouteETAs` (was hardcoded 30min)
- **Order-Based Billing:** Per-order pricing with metered AI/SMS (replaced per-seat model)
- **402 Handling:** Frontend `BillingError` + `BillingBlockedModal`
- **Activity Logging:** Added to orders, fleet, billing, notifications, POD, driver modules
- **Report Worker:** Real data queries (order stats, driver performance, route efficiency)
- **Cron Scheduling:** 5 BullMQ job schedulers (billing, integrations, reports, templates, retention)

### Onboarding
- **5-Step Wizard:** Vehicle → Driver → Order → Route → Notifications
- **Progress Tracking:** `onboardingCompletedAt` + `onboardingStep` on tenants table
- **Skip/Complete:** Admin-only actions, dismissible banner in DashboardLayout

### Operational Features
- **Route Templates:** CRUD + cron-based recurring generation via `cron-parser`
- **Batch Operations:** Bulk status update + route assignment (max 100 orders), fleet batch import
- **Messaging:** Driver-dispatcher chat (cursor-based, Socket.IO broadcast, unread badge)
- **Dispatch Board:** Kanban drag-and-drop with HTML5 DnD API

### GDPR & Observability
- **Data Export:** Full tenant data as JSON (queued via BullMQ, 7-day expiry)
- **Account Deletion:** 30-day grace period, email confirmation token, cascade delete
- **Data Retention:** Automated cleanup — location 90d, activity 365d, notifications 180d, webhooks 90d
- **Health Dashboard:** DB/Redis latency, queue depths, memory, uptime (Settings > Health)
- **Structured Logging:** JSON logger across all 11 worker queues

### New DB Tables (Phase 5)
- `password_reset_tokens` — Secure password reset flow
- `route_templates` — Recurring route definitions with cron rules
- `messages` — Driver-dispatcher messaging
- `data_export_requests` + `data_deletion_requests` — GDPR compliance

### New API Routes (Phase 5)
- `/api/auth/{verify-email,resend-verification,forgot-password,reset-password}`
- `/api/onboarding/{status,complete,skip}`
- `/api/route-templates` (CRUD + generate)
- `/api/orders/batch/{status,assign}`
- `/api/fleet/{vehicles,drivers}/batch`
- `/api/messages` (CRUD + unread-count)
- `/api/gdpr/{export,exports,delete-account}`
- `/api/admin/health`

### New Frontend Routes (Phase 5)
- `/verify-email`, `/forgot-password`, `/reset-password`
- `/dashboard/dispatch` (Manual kanban + AI auto-dispatch tabs)
- Settings tabs: Privacy (9th), Health (10th) — now 9 total tabs

### Worker Queues (Phase 5)
11 total queues (was 8): + `route-template`, `data-export`, `data-retention`

## Natural Language Operations (NLOps)

### Overview

NLOps transforms HOMER from a traditional UI-driven platform into a conversational operations interface. Users can control fleet operations through natural language: "Marcus called in sick, reassign his route" — and HOMER executes multi-step operations with tool calling.

### Architecture

```
User types command
        │
        ▼
┌─ AIChatPanel (frontend) ──────────────┐
│ POST /api/ai/ops (SSE stream)          │
└───────────────┬────────────────────────┘
                │
                ▼
┌─ Agent Loop (lib/ai/agent.ts) ─────────┐
│ Provider abstraction (Anthropic/OpenAI) │
│                                         │
│ Loop: send messages + tools → model     │
│   ├─ stop_reason=tool_use → execute     │
│   │   ├─ read tool → run immediately    │
│   │   └─ mutate tool → pause + confirm  │
│   └─ stop_reason=end_turn → respond     │
│                                         │
│ Max 10 iterations safety valve          │
└─────────────────────────────────────────┘
                │
     SSE events stream to frontend:
     thinking, tool_start, tool_result,
     message, confirmation, action_result,
     error, done
```

### Models

- **Primary:** Claude Opus 4.6 (`claude-opus-4-6`) via Anthropic API
- **Alternative:** GPT-5.4 via OpenAI API
- Configurable via `NLOPS_PROVIDER`, `NLOPS_ANTHROPIC_MODEL`, `NLOPS_OPENAI_MODEL` env vars

### Tool Registry (19 tools)

**Query Tools (read-only, no confirmation):**
- `get_operational_summary` — Fleet snapshot: routes, drivers, pending orders
- `search_orders` — Search by customer, status, date range
- `get_order_details` — Full order with POD, tracking
- `get_route_details` — Route with all stops and progress
- `list_routes` — Filtered route listing
- `find_driver` — Search driver by name
- `get_available_drivers` — All available drivers with vehicles
- `get_driver_performance` — Driver metrics (7d/30d/90d)
- `get_analytics` — Fleet KPIs (7d/30d/90d)

**Mutation Tools (require confirmation):**
- `assign_order_to_route` — Add orders to route (mutate)
- `update_order_status` — Change order status (mutate)
- `change_driver_status` — Set available/on_break/offline (mutate)
- `create_route` — Create new route (mutate)
- `optimize_route` — AI-optimize stop order (mutate)
- `transition_route_status` — draft→planned→in_progress→completed (mutate)
- `send_customer_notification` — Trigger SMS/email (mutate)
- `reassign_orders` — Move orders between routes (destructive)
- `auto_dispatch` — Generate routes for all unassigned orders (destructive)
- `cancel_route` — Cancel route, unassign orders (destructive)

### Confirmation Tiers

| Tier | Risk Level | UX | Example |
|------|-----------|-----|---------|
| 1 | read | Instant execution | "Where is Marcus?" |
| 2 | mutate | Inline confirm card | "Mark #4521 as delivered" |
| 3 | destructive | Full preview + confirm | "Reassign Marcus's route" |

### RBAC

Tools are filtered by user role before being sent to the model. The model cannot attempt actions the user isn't authorized for.

| Role | Tools Available |
|------|----------------|
| owner | All 19 |
| admin | All 19 |
| dispatcher | All 19 |
| driver | 2 (operational summary, route details) |

### SSE Protocol

`POST /api/ai/ops` returns a `text/event-stream` with typed events:

```
event: thinking     → Agent reasoning text
event: tool_start   → Tool call initiated (name, input)
event: tool_result  → Tool call completed (summary, duration)
event: message      → Final text response
event: confirmation → Mutation needs user approval (preview data)
event: action_result → Confirmed action executed (success/failure)
event: error        → Something went wrong
event: done         → Stream complete
```

### Frontend: Thought Overlay

The AIChatPanel includes a toggleable full-screen "thought overlay" that shows:
- Every tool call with inputs, outputs, and timing
- Agent reasoning text
- Confirmation states
- Execution results

Users control visibility with a `{ }` toggle button. When hidden, the panel shows only the final response with compact tool activity indicators.

### File Structure

```
packages/api/src/lib/ai/
├── claude.ts           # Legacy text-in/text-out (kept)
├── providers.ts        # Multi-model abstraction (Anthropic + OpenAI)
├── agent.ts            # Agentic loop engine
└── tools/
    ├── types.ts         # Tool interface + result summarizer
    ├── index.ts         # Registry + RBAC filtering
    ├── query.ts         # 9 read-only tools
    └── mutations.ts     # 10 mutation tools
```

### Metering

One "NLOps interaction" = one user message, regardless of internal tool calls. Metered as `aiChatMessages` (50/mo free, $0.02/msg pay-as-you-go). Confirmations don't consume quota.

## Deployment

- **CI/CD:** GitHub Actions → test → deploy to ovh2 via SSH
- **Process:** PM2 manages 2 API instances (cluster) + 1 worker
- **Proxy:** Caddy handles TLS + routing for all subdomains
- **Demo:** Static files served from `/opt/homer-io/site`
