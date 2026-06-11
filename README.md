# HOMER.io

AI-powered last-mile delivery logistics platform. HOMER gives small and mid-size delivery fleets route optimization, real-time tracking, proof of delivery, customer notifications, and a natural-language AI copilot ("NLOps") — with industry-specific compliance features for 8 verticals: cannabis, florist, pharmacy, restaurant, grocery, furniture, courier, and general.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full system design, data model, and API surface.

## Monorepo Layout

Turborepo workspace with six packages:

| Package | What it is |
|---------|------------|
| [`packages/shared`](./packages/shared) | Zod schemas, types, and constants shared by API and clients |
| [`packages/api`](./packages/api) | Fastify 5 backend — REST API, Socket.IO, Drizzle ORM, NLOps agent loop |
| [`packages/web`](./packages/web) | React 19 + Vite SPA — dispatcher dashboard, driver PWA, public landing/demo |
| [`packages/worker`](./packages/worker) | BullMQ background jobs — notifications, webhooks, reports, delivery learning, telematics polling |
| [`packages/mobile`](./packages/mobile) | Expo / React Native app for drivers and dispatchers |
| [`packages/cli`](./packages/cli) | `homer` CLI + `homer-mcp` MCP server for API access from terminals and AI agents |

Other directories: `infra/` (Caddy, PM2, OSRM setup), `drizzle/` (SQL migrations), `scripts/audit/` (productionization audit harness — see [docs/production-audit.md](./docs/production-audit.md)), `legacy/demo-site/` (original prototype, preserved for reference only).

## Tech Stack

Node.js 22 · Fastify 5 · PostgreSQL 16 + PostGIS · Drizzle ORM · Redis 7 (cache + BullMQ) · Socket.IO · MinIO · React 19 + Vite + Zustand · OSRM + in-house VRP solver for routing · Claude / GPT for NLOps · Turborepo · PM2 + Caddy in production.

## Getting Started

Prerequisites: Node.js 22.9+ (dev scripts use `--env-file-if-exists`), PostgreSQL 16 with PostGIS, Redis 7. MinIO is optional (needed for proof-of-delivery file storage), as is a self-hosted OSRM instance (route optimization falls back to haversine distances without it).

```bash
npm install

# Configure environment — DATABASE_URL, REDIS_URL, and JWT_SECRET are the
# required core; everything else degrades gracefully when unset. The api and
# worker dev scripts auto-load this root .env (shell env takes precedence);
# production loads it via PM2's --env-file instead.
cp .env.example .env

# Apply committed SQL migrations (drizzle/*.sql, in order). Reads DATABASE_URL
# from the shell, defaulting to the same localhost URL as .env.example.
npm run -w @homer-io/api db:migrate:run

# Run the stack (separate terminals)
npm run dev:api      # Fastify API on :3000
npm run dev:web      # Vite dev server on :3001
npm run dev:worker   # BullMQ workers
```

API docs (Swagger) are served at `/api/docs` once the API is up.

## Development Commands

```bash
npm run build        # turbo build across all packages
npm test             # turbo test (vitest) across all packages
npm run lint         # eslint across all packages
npm run typecheck    # tsc --noEmit across all packages

npm run db:generate  # generate Drizzle migration from schema changes
npm run audit:cycle  # run the productionization audit harness (see docs/)
```

Schema changes are committed as hand-reviewed SQL in `drizzle/` and applied with `db:migrate:run`; `drizzle-kit push` is for local experiments only.

## Notes for Contributors

- Every table is tenant-scoped (`tenant_id` FK); all queries must filter by the authenticated tenant.
- Cross-industry features are toggled per tenant (`tenant.settings.enabledFeatures`), with industry selection only setting defaults.
- The worker package intentionally duplicates some API-package logic (schemas, connector fetchers) to avoid cross-package runtime imports — keep both sides in sync when touching either.
- `claudepad.md` holds session-by-session engineering history; `ARCHITECTURE.md` is the canonical design reference.
