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

## API Design

RESTful API at `/api/*`:

- `POST /api/auth/register` — Create org + owner account
- `POST /api/auth/login` — JWT authentication
- `POST /api/auth/refresh` — Token refresh (rotation)
- `GET /api/auth/me` — Current user profile
- `CRUD /api/fleet/vehicles` — Vehicle management
- `CRUD /api/fleet/drivers` — Driver management
- `CRUD /api/orders` — Order management
- `POST /api/orders/import/csv` — CSV bulk import
- `CRUD /api/routes` — Route management
- `POST /api/routes/:id/optimize` — AI route optimization
- `GET /health` — Health check

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
