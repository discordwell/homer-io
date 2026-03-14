# Claudepad — Session Memory

## Session Summaries

### 2026-03-13T UTC — Phase 0 Foundation Build
- Implemented full Phase 0: Turborepo monorepo, Fastify API, Drizzle/Postgres schema, shared Zod schemas, auth module (JWT + refresh tokens + argon2), fleet/orders/routes CRUD, web frontend (login/register/dashboard), BullMQ worker skeleton, CI/CD pipeline, Caddy config, ARCHITECTURE.md.
- Demo (src/App.jsx) preserved — builds independently via `npm run build:demo`.
- All packages type-check clean. Shared package builds successfully.

---

## Key Findings

- **Demo design tokens**: Colors at `C` object (bg: #03080F, accent: #5BA4F5, etc.), fonts at `F` (Syne display, Inter body, JetBrains Mono). Replicated in `packages/web/src/theme.ts`.
- **Demo API calls**: Direct to `api.anthropic.com` with `claude-sonnet-4-20250514` — needs to be proxied through our API in the product.
- **Demo never modified**: All new code in `packages/`. Root vite.config.js and src/ untouched.
- **Fastify reply helpers**: Using `@fastify/sensible` for `reply.unauthorized()`, `reply.forbidden()`, etc.
- **Drizzle numeric columns**: Stored as strings in JS, need explicit parsing when doing math.
- **Package versions**: React 19.2.4, Vite 8.0.0, Fastify 5.3.0, Drizzle 0.44.0, Zod 3.25.0.
