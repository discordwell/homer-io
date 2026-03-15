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
| AI | Anthropic Claude API | Route optimization + copilot |
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
- `POST /api/routes/:id/optimize` — AI route optimization (Claude-powered)
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
/dashboard/settings       → SettingsPage (org, team, API keys, notifications, webhooks)
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

45+ shared components in `packages/web/src/components/`:

**Core UI:** Badge, Pill, Bar, KPICard, FormField, SelectField, Modal, DataTable, EmptyState, Toast, LoadingSpinner, ConfirmDialog
**Layout:** Sidebar, DashboardLayout, AIChatPanel, NotificationCenter, NotificationItem
**Maps:** RouteMap, AddressSearch, LiveFleetMap, DriverMarker, DeliveryEventFeed
**Analytics:** TrendChart, DriverLeaderboard, RouteEfficiencyCard
**Settings:** OrganizationTab, TeamTab, ApiKeysTab, NotificationsTab, NotificationTemplateEditor, CustomerNotificationLog, WebhooksTab, WebhookEndpointForm, WebhookDeliveryLog
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

## Real-Time Infrastructure

- **Socket.IO** server attached to Fastify's HTTP server on `/fleet` namespace
- JWT auth middleware verifies tokens from handshake
- Tenant room isolation (`tenant:{id}`) for multi-tenant broadcasts
- Events: `driver:location`, `route:status`, `delivery:event`, `notification:new`

## Background Workers (BullMQ)

5 job queues processed by `packages/worker/`:

| Queue | Concurrency | Purpose |
|-------|-------------|---------|
| `route-optimization` | 2 | AI-powered route optimization |
| `notifications` | 5 | In-app notification persistence |
| `analytics` | 1 | Aggregate analytics computation |
| `customer-notifications` | 5 | SMS (Twilio) + email (SendGrid) delivery |
| `webhook-delivery` | 10 | HMAC-signed webhook POST with exponential backoff (5 retries) |

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

## Deployment

- **CI/CD:** GitHub Actions → test → deploy to ovh2 via SSH
- **Process:** PM2 manages 2 API instances (cluster) + 1 worker
- **Proxy:** Caddy handles TLS + routing for all subdomains
- **Demo:** Static files served from `/opt/homer-io/site`
