# V2 Auth: Google OAuth + Org Resolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace V1 email-only auth with Google OAuth sign-in, automatic org resolution (domain auto-join), email linking, and dynamic demo org seeding.

**Architecture:** Google OAuth via `google-auth-library` on the backend — frontend uses Google's `GoogleLogin` component which returns an ID token (credential). Backend verifies the ID token with audience check via `verifyIdToken`, then issues our existing JWT/refresh tokens. New users hit an org resolution flow: join an existing org by domain, start fresh, or get a demo org with dynamically seeded Bay Area data. Email linking lets personal-email users join org-domain tenants later.

**Tech Stack:** `google-auth-library` (backend ID token verification), `@react-oauth/google` (frontend `GoogleLogin` component), Drizzle ORM migrations, existing Fastify/JWT stack.

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `packages/shared/src/schemas/google-auth.ts` | Zod schemas for Google auth & org choice requests/responses |
| `packages/api/src/modules/auth/google.ts` | Google ID token verification + org resolution logic |
| `packages/api/src/modules/auth/demo-seed.ts` | Dynamic demo org data generator (vehicles, drivers, orders, routes) |
| `packages/api/src/modules/auth/domain.ts` | Domain extraction, generic domain list, tenant domain matching |
| `packages/api/src/modules/auth/email-link.ts` | Email linking service (request + verify) |
| `packages/api/src/__tests__/google-auth.test.ts` | Tests for Google auth flow, org resolution, domain matching |
| `packages/api/src/__tests__/demo-seed.test.ts` | Tests for demo seed data generation |
| `packages/api/src/__tests__/email-link.test.ts` | Tests for email linking flow |
| `packages/web/src/pages/OrgChoice.tsx` | Post-sign-up org resolution page (join/fresh/demo) |
| `packages/web/src/components/GoogleSignInButton.tsx` | Reusable Google sign-in button wrapper |

### Modified Files

| File | Changes |
|------|---------|
| `packages/api/src/lib/db/schema/tenants.ts` | Add `orgDomain`, `autoJoinEnabled`, `isDemo` columns |
| `packages/api/src/lib/db/schema/users.ts` | Add `googleId`, `avatarUrl` columns |
| `packages/api/src/modules/auth/routes.ts` | Register Google auth + email-link routes with rate limiting |
| `packages/api/src/modules/auth/service.ts` | Export `generateAuthResponse`, add `avatarUrl` to response, update `getMe` and `register` |
| `packages/api/src/config.ts` | Add `google.clientId` config |
| `packages/api/package.json` | Add `google-auth-library` dependency |
| `packages/shared/src/index.ts` | Export google-auth schemas |
| `packages/shared/src/schemas/auth.ts` | Add `avatarUrl` to `userResponseSchema` and `authResponseSchema` |
| `packages/web/package.json` | Add `@react-oauth/google` dependency |
| `packages/web/src/pages/Login.tsx` | Add Google sign-in button |
| `packages/web/src/pages/Register.tsx` | Add Google sign-in button |
| `packages/web/src/App.tsx` | Add `/org-choice` route, wrap app in `GoogleOAuthProvider` |
| `packages/web/src/stores/auth.ts` | Add `pendingGoogleUser` state (excluded from persistence) |
| `.env.example` | Add `GOOGLE_CLIENT_ID` |

---

## Task 1: Shared Schemas for Google Auth

**Files:**
- Create: `packages/shared/src/schemas/google-auth.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/shared/src/schemas/auth.ts`

- [ ] **Step 1: Write the google-auth schema file**

```typescript
// packages/shared/src/schemas/google-auth.ts
import { z } from 'zod';
import { ROLES } from '../types/roles.js';

export const googleAuthSchema = z.object({
  credential: z.string().min(1),
});
export type GoogleAuthInput = z.infer<typeof googleAuthSchema>;

export const orgChoiceSchema = z.object({
  credential: z.string().min(1),
  choice: z.enum(['join', 'fresh', 'demo']),
  orgName: z.string().min(1).max(255).optional(), // required for 'fresh' and 'demo'
});
export type OrgChoiceInput = z.infer<typeof orgChoiceSchema>;

export const orgOptionSchema = z.object({
  type: z.enum(['join', 'fresh', 'demo']),
  tenantId: z.string().uuid().optional(), // present for 'join'
  tenantName: z.string().optional(), // present for 'join'
});
export type OrgOption = z.infer<typeof orgOptionSchema>;

export const googleAuthResponseSchema = z.object({
  status: z.enum(['existing_user', 'new_user']),
  auth: z.object({
    accessToken: z.string(),
    refreshToken: z.string(),
    user: z.object({
      id: z.string().uuid(),
      email: z.string().email(),
      name: z.string(),
      role: z.enum(ROLES),
      tenantId: z.string().uuid(),
      createdAt: z.string().datetime(),
      avatarUrl: z.string().nullable().optional(),
    }),
  }).optional(),
  orgOptions: z.array(orgOptionSchema).optional(),
  googleEmail: z.string().email().optional(),
  googleName: z.string().optional(),
});
export type GoogleAuthResponse = z.infer<typeof googleAuthResponseSchema>;

export const emailLinkRequestSchema = z.object({
  workEmail: z.string().email(),
});
export type EmailLinkRequest = z.infer<typeof emailLinkRequestSchema>;

export const emailLinkVerifySchema = z.object({
  token: z.string().min(1),
});
export type EmailLinkVerifyInput = z.infer<typeof emailLinkVerifySchema>;
```

- [ ] **Step 2: Add `avatarUrl` to `userResponseSchema` in auth.ts**

In `packages/shared/src/schemas/auth.ts`, add to the `userResponseSchema` z.object:

```typescript
avatarUrl: z.string().nullable().optional(),
```

The `authResponseSchema` embeds `userResponseSchema` so it gets `avatarUrl` automatically.

- [ ] **Step 3: Export from shared index**

Add to `packages/shared/src/index.ts`:

```typescript
export * from './schemas/google-auth.js';
```

- [ ] **Step 4: Run shared tests**

Run: `cd packages/shared && npm test`
Expected: All existing tests pass

- [ ] **Step 5: Commit**

```bash
git add packages/shared/
git commit -m "feat(shared): add Google auth and email-link Zod schemas"
```

---

## Task 2: Database Schema Changes

**Files:**
- Modify: `packages/api/src/lib/db/schema/tenants.ts`
- Modify: `packages/api/src/lib/db/schema/users.ts`

- [ ] **Step 1: Write test for new schema columns**

Create `packages/api/src/__tests__/google-auth.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

describe('Google Auth - Schema columns', () => {
  it('users table has googleId column defined', async () => {
    const { users } = await import('../lib/db/schema/users.js');
    expect(users.googleId).toBeDefined();
  });

  it('users table has avatarUrl column defined', async () => {
    const { users } = await import('../lib/db/schema/users.js');
    expect(users.avatarUrl).toBeDefined();
  });

  it('tenants table has orgDomain column defined', async () => {
    const { tenants } = await import('../lib/db/schema/tenants.js');
    expect(tenants.orgDomain).toBeDefined();
  });

  it('tenants table has autoJoinEnabled column defined', async () => {
    const { tenants } = await import('../lib/db/schema/tenants.js');
    expect(tenants.autoJoinEnabled).toBeDefined();
  });

  it('tenants table has isDemo column defined', async () => {
    const { tenants } = await import('../lib/db/schema/tenants.js');
    expect(tenants.isDemo).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/api && npx vitest run src/__tests__/google-auth.test.ts`
Expected: FAIL — `googleId`, `avatarUrl`, `orgDomain`, etc. are undefined

- [ ] **Step 3: Add columns to users table**

In `packages/api/src/lib/db/schema/users.ts`, add these columns to the `users` pgTable definition:

```typescript
googleId: varchar('google_id', { length: 255 }).unique(),
avatarUrl: varchar('avatar_url', { length: 500 }),
```

- [ ] **Step 4: Add columns to tenants table**

In `packages/api/src/lib/db/schema/tenants.ts`, add `boolean` to the import from `drizzle-orm/pg-core`, then add these columns to the `tenants` pgTable definition:

```typescript
orgDomain: varchar('org_domain', { length: 255 }),
autoJoinEnabled: boolean('auto_join_enabled').default(true).notNull(),
isDemo: boolean('is_demo').default(false).notNull(),
```

Also add an index on `orgDomain` for the domain lookup query:

```typescript
index('idx_tenants_org_domain').on(table.orgDomain),
```

(This requires adding the `index` import and a table callback — follow the pattern in `users.ts`.)

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/api && npx vitest run src/__tests__/google-auth.test.ts`
Expected: PASS

- [ ] **Step 6: Generate Drizzle migration**

Run: `cd packages/api && npm run db:generate`
Expected: New migration SQL file in `packages/api/drizzle/`

- [ ] **Step 7: Commit**

```bash
git add packages/api/src/lib/db/schema/ packages/api/drizzle/
git commit -m "feat(db): add Google auth and org domain columns to users/tenants"
```

---

## Task 3: Domain Resolution Logic

**Files:**
- Create: `packages/api/src/modules/auth/domain.ts`
- Test: `packages/api/src/__tests__/google-auth.test.ts` (append)

- [ ] **Step 1: Write domain logic tests**

Append to `packages/api/src/__tests__/google-auth.test.ts`:

```typescript
import { extractDomain, isGenericDomain } from '../modules/auth/domain.js';

describe('Domain resolution', () => {
  it('extracts domain from email', () => {
    expect(extractDomain('user@acme.com')).toBe('acme.com');
    expect(extractDomain('USER@ACME.COM')).toBe('acme.com');
  });

  it('identifies generic email domains', () => {
    expect(isGenericDomain('gmail.com')).toBe(true);
    expect(isGenericDomain('yahoo.com')).toBe(true);
    expect(isGenericDomain('hotmail.com')).toBe(true);
    expect(isGenericDomain('outlook.com')).toBe(true);
    expect(isGenericDomain('icloud.com')).toBe(true);
    expect(isGenericDomain('protonmail.com')).toBe(true);
  });

  it('identifies non-generic domains', () => {
    expect(isGenericDomain('acme.com')).toBe(false);
    expect(isGenericDomain('homer.io')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/api && npx vitest run src/__tests__/google-auth.test.ts`
Expected: FAIL — cannot import `domain.ts`

- [ ] **Step 3: Implement domain.ts**

Create `packages/api/src/modules/auth/domain.ts`:

```typescript
import { eq, and } from 'drizzle-orm';
import { db } from '../../lib/db/index.js';
import { tenants } from '../../lib/db/schema/tenants.js';

const GENERIC_DOMAINS = new Set([
  'gmail.com', 'googlemail.com',
  'yahoo.com', 'yahoo.co.uk', 'ymail.com',
  'hotmail.com', 'hotmail.co.uk', 'live.com', 'msn.com', 'outlook.com',
  'icloud.com', 'me.com', 'mac.com',
  'aol.com',
  'protonmail.com', 'proton.me', 'pm.me',
  'mail.com', 'zoho.com', 'fastmail.com',
  'hey.com', 'tutanota.com',
]);

export function extractDomain(email: string): string {
  return email.split('@')[1].toLowerCase();
}

export function isGenericDomain(domain: string): boolean {
  return GENERIC_DOMAINS.has(domain.toLowerCase());
}

export async function findTenantByDomain(domain: string) {
  if (isGenericDomain(domain)) return null;

  const [tenant] = await db
    .select({ id: tenants.id, name: tenants.name, autoJoinEnabled: tenants.autoJoinEnabled })
    .from(tenants)
    .where(and(eq(tenants.orgDomain, domain), eq(tenants.autoJoinEnabled, true)))
    .limit(1);

  return tenant || null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/api && npx vitest run src/__tests__/google-auth.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/modules/auth/domain.ts packages/api/src/__tests__/google-auth.test.ts
git commit -m "feat(auth): add domain extraction and generic domain detection"
```

---

## Task 4: Google ID Token Verification + Org Resolution Service

**Files:**
- Create: `packages/api/src/modules/auth/google.ts`
- Modify: `packages/api/src/modules/auth/service.ts`
- Modify: `packages/api/src/config.ts`
- Modify: `packages/api/package.json`
- Test: `packages/api/src/__tests__/google-auth.test.ts` (append)

- [ ] **Step 1: Install google-auth-library**

Run: `cd packages/api && npm install google-auth-library`

- [ ] **Step 2: Add Google client ID to config**

In `packages/api/src/config.ts`, update the `google` config block:

```typescript
google: {
  routesApiKey: process.env.GOOGLE_ROUTES_API_KEY || '',
  clientId: process.env.GOOGLE_CLIENT_ID || '',
},
```

- [ ] **Step 3: Add GOOGLE_CLIENT_ID to .env.example**

Append to `.env.example`:

```
# Google OAuth
GOOGLE_CLIENT_ID=
```

- [ ] **Step 4: Write tests for Google auth service**

Append to `packages/api/src/__tests__/google-auth.test.ts`:

```typescript
import { buildOrgOptions } from '../modules/auth/google.js';

describe('Google Auth - Org options', () => {
  it('returns fresh and demo options for generic email domains', () => {
    const options = buildOrgOptions(null);
    expect(options).toHaveLength(2);
    expect(options.map(o => o.type)).toEqual(['fresh', 'demo']);
  });

  it('includes join option when matching tenant found', () => {
    const tenant = { id: 'tenant-123', name: 'Acme Logistics', autoJoinEnabled: true };
    const options = buildOrgOptions(tenant);
    expect(options).toHaveLength(3);
    expect(options[0]).toEqual({
      type: 'join',
      tenantId: 'tenant-123',
      tenantName: 'Acme Logistics',
    });
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `cd packages/api && npx vitest run src/__tests__/google-auth.test.ts`
Expected: FAIL — cannot import `google.ts`

- [ ] **Step 6: Export `generateAuthResponse` and update `getMe` in service.ts**

In `packages/api/src/modules/auth/service.ts`:

**a)** Change `generateAuthResponse` from private to exported:

```typescript
export async function generateAuthResponse(
```

**b)** Add `avatarUrl` to the response user object:

```typescript
return {
  accessToken,
  refreshToken: rawRefreshToken,
  user: {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    tenantId: user.tenantId,
    createdAt: user.createdAt.toISOString(),
    avatarUrl: user.avatarUrl || null,
  },
};
```

**c)** Update `getMe` to include `avatarUrl` — add `avatarUrl: users.avatarUrl` to the select, and `avatarUrl: user.avatarUrl || null` to the return object.

- [ ] **Step 7: Implement google.ts**

Create `packages/api/src/modules/auth/google.ts`:

```typescript
import { FastifyInstance } from 'fastify';
import { OAuth2Client } from 'google-auth-library';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import { config } from '../../config.js';
import { db } from '../../lib/db/index.js';
import { users } from '../../lib/db/schema/users.js';
import { tenants } from '../../lib/db/schema/tenants.js';
import { generateAuthResponse } from './service.js';
import { extractDomain, isGenericDomain, findTenantByDomain } from './domain.js';
import { seedDemoOrg } from './demo-seed.js';
import { createStripeCustomer } from '../billing/service.js';
import type { GoogleAuthInput, OrgChoiceInput, OrgOption } from '@homer-io/shared';

const client = new OAuth2Client(config.google.clientId);

interface GoogleProfile {
  googleId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

async function verifyGoogleToken(credential: string): Promise<GoogleProfile> {
  const ticket = await client.verifyIdToken({
    idToken: credential,
    audience: config.google.clientId,
  });
  const payload = ticket.getPayload();
  if (!payload || !payload.email) {
    throw new Error('Invalid Google token');
  }
  return {
    googleId: payload.sub,
    email: payload.email.toLowerCase(),
    name: payload.name || payload.email.split('@')[0],
    avatarUrl: payload.picture || null,
  };
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50) + '-' + randomBytes(4).toString('hex');
}

export function buildOrgOptions(matchingTenant: { id: string; name: string } | null): OrgOption[] {
  const options: OrgOption[] = [];
  if (matchingTenant) {
    options.push({ type: 'join', tenantId: matchingTenant.id, tenantName: matchingTenant.name });
  }
  options.push({ type: 'fresh' });
  options.push({ type: 'demo' });
  return options;
}

export async function googleAuth(app: FastifyInstance, input: GoogleAuthInput) {
  const profile = await verifyGoogleToken(input.credential);

  // Case 1: User exists with this googleId
  const [existingByGoogle] = await db
    .select()
    .from(users)
    .where(eq(users.googleId, profile.googleId))
    .limit(1);

  if (existingByGoogle) {
    if (!existingByGoogle.isActive) {
      throw app.httpErrors.forbidden('Account is disabled');
    }
    await db.update(users).set({
      lastLoginAt: new Date(),
      avatarUrl: profile.avatarUrl,
    }).where(eq(users.id, existingByGoogle.id));
    const auth = await generateAuthResponse(app, { ...existingByGoogle, avatarUrl: profile.avatarUrl });
    return { status: 'existing_user' as const, auth };
  }

  // Case 2: User exists with same email but no googleId — link and log in
  const [existingByEmail] = await db
    .select()
    .from(users)
    .where(eq(users.email, profile.email))
    .limit(1);

  if (existingByEmail) {
    if (!existingByEmail.isActive) {
      throw app.httpErrors.forbidden('Account is disabled');
    }
    await db.update(users).set({
      googleId: profile.googleId,
      avatarUrl: profile.avatarUrl,
      emailVerified: true,
      lastLoginAt: new Date(),
    }).where(eq(users.id, existingByEmail.id));
    const auth = await generateAuthResponse(app, {
      ...existingByEmail,
      googleId: profile.googleId,
      avatarUrl: profile.avatarUrl,
    });
    return { status: 'existing_user' as const, auth };
  }

  // Case 3: New user — check for domain match, present options
  const domain = extractDomain(profile.email);
  const matchingTenant = isGenericDomain(domain) ? null : await findTenantByDomain(domain);
  const orgOptions = buildOrgOptions(matchingTenant);

  return {
    status: 'new_user' as const,
    orgOptions,
    googleEmail: profile.email,
    googleName: profile.name,
  };
}

export async function googleOrgChoice(app: FastifyInstance, input: OrgChoiceInput) {
  const profile = await verifyGoogleToken(input.credential);

  // Verify this user doesn't already exist (race condition guard)
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, profile.email))
    .limit(1);
  if (existing) {
    throw app.httpErrors.conflict('Account already exists. Please sign in.');
  }

  if (input.choice === 'join') {
    const domain = extractDomain(profile.email);
    const tenant = await findTenantByDomain(domain);
    if (!tenant) {
      throw app.httpErrors.badRequest('No organization found for your domain');
    }

    const [user] = await db.insert(users).values({
      tenantId: tenant.id,
      email: profile.email,
      googleId: profile.googleId,
      name: profile.name,
      avatarUrl: profile.avatarUrl,
      role: 'dispatcher',
      emailVerified: true,
    }).returning();

    const auth = await generateAuthResponse(app, user);
    return { status: 'existing_user' as const, auth };
  }

  // 'fresh' or 'demo' — create new tenant
  const orgName = input.orgName || `${profile.name}'s Org`;
  const domain = extractDomain(profile.email);

  const result = await db.transaction(async (tx) => {
    const [tenant] = await tx.insert(tenants).values({
      name: orgName,
      slug: slugify(orgName),
      orgDomain: isGenericDomain(domain) ? null : domain,
      isDemo: input.choice === 'demo',
    }).returning();

    const [user] = await tx.insert(users).values({
      tenantId: tenant.id,
      email: profile.email,
      googleId: profile.googleId,
      name: profile.name,
      avatarUrl: profile.avatarUrl,
      role: 'owner',
      emailVerified: true,
    }).returning();

    return { tenant, user };
  });

  // Stripe customer (fire and forget)
  createStripeCustomer(result.tenant.id, profile.email, orgName)
    .catch(err => console.error('[google-auth] Stripe customer creation failed:', err));

  // Seed demo data if requested
  if (input.choice === 'demo') {
    await seedDemoOrg(result.tenant.id);
  }

  const auth = await generateAuthResponse(app, result.user);
  return { status: 'existing_user' as const, auth };
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `cd packages/api && npx vitest run src/__tests__/google-auth.test.ts`
Expected: PASS (the `buildOrgOptions` tests pass; full integration tests in later task)

- [ ] **Step 9: Commit**

```bash
git add packages/api/ .env.example
git commit -m "feat(auth): implement Google OAuth verification and org resolution"
```

---

## Task 5: Demo Org Seed Generator

**Files:**
- Create: `packages/api/src/modules/auth/demo-seed.ts`
- Test: `packages/api/src/__tests__/demo-seed.test.ts`

- [ ] **Step 1: Write tests for demo seed**

Create `packages/api/src/__tests__/demo-seed.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { generateDemoVehicles, generateDemoDriverNames, generateDemoOrders, BAY_AREA_LOCATIONS } from '../modules/auth/demo-seed.js';

describe('Demo seed - data generation', () => {
  it('generates 4 vehicles with Bay Area context', () => {
    const vehicles = generateDemoVehicles();
    expect(vehicles).toHaveLength(4);
    vehicles.forEach(v => {
      expect(v.name).toBeDefined();
      expect(['car', 'van', 'truck', 'cargo_bike']).toContain(v.type);
    });
  });

  it('generates 5 driver names', () => {
    const names = generateDemoDriverNames();
    expect(names).toHaveLength(5);
    names.forEach(n => expect(n.length).toBeGreaterThan(0));
  });

  it('generates orders with today timestamps', () => {
    const orders = generateDemoOrders();
    const today = new Date().toISOString().slice(0, 10);
    expect(orders.length).toBeGreaterThanOrEqual(15);
    expect(orders.length).toBeLessThanOrEqual(20);
    orders.forEach(o => {
      expect(o.recipientName).toBeDefined();
      expect(o.deliveryAddress).toBeDefined();
      expect(o.deliveryLat).toBeDefined();
      expect(o.deliveryLng).toBeDefined();
      expect(o.createdAt.toISOString().slice(0, 10)).toBe(today);
    });
  });

  it('has realistic Bay Area locations', () => {
    expect(BAY_AREA_LOCATIONS.length).toBeGreaterThanOrEqual(20);
    BAY_AREA_LOCATIONS.forEach(loc => {
      // Bay Area lat range: roughly 37.2 - 38.0
      expect(loc.lat).toBeGreaterThan(37.2);
      expect(loc.lat).toBeLessThan(38.0);
      // Bay Area lng range: roughly -122.6 - -121.7
      expect(loc.lng).toBeGreaterThan(-122.6);
      expect(loc.lng).toBeLessThan(-121.7);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/api && npx vitest run src/__tests__/demo-seed.test.ts`
Expected: FAIL — cannot import `demo-seed.ts`

- [ ] **Step 3: Implement demo-seed.ts**

Create `packages/api/src/modules/auth/demo-seed.ts`:

```typescript
import { eq } from 'drizzle-orm';
import { db } from '../../lib/db/index.js';
import { vehicles } from '../../lib/db/schema/vehicles.js';
import { drivers } from '../../lib/db/schema/drivers.js';
import { orders } from '../../lib/db/schema/orders.js';
import { routes } from '../../lib/db/schema/routes.js';

export const BAY_AREA_LOCATIONS = [
  { name: '555 Market St, San Francisco', lat: 37.7900, lng: -122.4000 },
  { name: '1 Ferry Building, San Francisco', lat: 37.7956, lng: -122.3935 },
  { name: '900 North Point St, San Francisco', lat: 37.8060, lng: -122.4210 },
  { name: '3251 20th Ave, San Francisco', lat: 37.7290, lng: -122.4750 },
  { name: '2100 University Ave, Berkeley', lat: 37.8720, lng: -122.2680 },
  { name: '1955 Broadway, Oakland', lat: 37.8120, lng: -122.2690 },
  { name: '5959 Shellmound St, Emeryville', lat: 37.8390, lng: -122.2930 },
  { name: '1600 Saratoga Ave, San Jose', lat: 37.2800, lng: -121.9980 },
  { name: '355 Santana Row, San Jose', lat: 37.3210, lng: -121.9480 },
  { name: '100 El Camino Real, Palo Alto', lat: 37.4420, lng: -122.1630 },
  { name: '300 University Ave, Palo Alto', lat: 37.4480, lng: -122.1590 },
  { name: '1450 Burlingame Ave, Burlingame', lat: 37.5790, lng: -122.3440 },
  { name: '1 Hacker Way, Menlo Park', lat: 37.4850, lng: -122.1480 },
  { name: '2855 Stevens Creek Blvd, Santa Clara', lat: 37.3240, lng: -121.9690 },
  { name: '100 Broadway, Millbrae', lat: 37.5985, lng: -122.3870 },
  { name: '333 Main St, Redwood City', lat: 37.4860, lng: -122.2290 },
  { name: '1250 Fourth St, San Rafael', lat: 37.9720, lng: -122.5100 },
  { name: '80 E 4th Ave, San Mateo', lat: 37.5650, lng: -122.3240 },
  { name: '1001 Marina Village Pkwy, Alameda', lat: 37.7790, lng: -122.2480 },
  { name: '2700 Ygnacio Valley Rd, Walnut Creek', lat: 37.9020, lng: -122.0650 },
  { name: '1999 Harrison St, Oakland', lat: 37.8080, lng: -122.2630 },
  { name: '39 Mesa St, San Francisco', lat: 37.7610, lng: -122.4130 },
  { name: '699 Lewelling Blvd, San Leandro', lat: 37.7060, lng: -122.1250 },
  { name: '3000 El Cerrito Plaza, El Cerrito', lat: 37.9020, lng: -122.3000 },
];

const FIRST_NAMES = ['Marcus', 'Priya', 'Carlos', 'Aisha', 'Jordan', 'Mei', 'Diego', 'Sarah'];
const LAST_NAMES = ['Johnson', 'Patel', 'Rodriguez', 'Williams', 'Chen', 'Garcia', 'Kim', 'Davis'];
const RECIPIENT_NAMES = [
  'Alex Thompson', 'Jamie Lee', 'Sam Nakamura', 'Riley Brooks', 'Morgan Chen',
  'Casey Alvarez', 'Quinn Patel', 'Taylor Okafor', 'Jordan Hernandez', 'Avery Singh',
  'Blake Watanabe', 'Drew Martinez', 'Ellis Kim', 'Finley Shah', 'Harper Nguyen',
  'Kai Robinson', 'Logan Tanaka', 'Noa Petrov', 'Reese Inoue', 'Sage Moreno',
];

export function generateDemoVehicles() {
  return [
    { name: 'Van #1 — Sprinter', type: 'van' as const, licensePlate: '8ABC123', fuelType: 'diesel' as const, capacityWeight: '2000', capacityCount: 80 },
    { name: 'Van #2 — Transit', type: 'van' as const, licensePlate: '7DEF456', fuelType: 'gasoline' as const, capacityWeight: '1500', capacityCount: 60 },
    { name: 'Sedan — Civic', type: 'car' as const, licensePlate: '6GHI789', fuelType: 'hybrid' as const, capacityWeight: '200', capacityCount: 15 },
    { name: 'Cargo Bike', type: 'cargo_bike' as const, licensePlate: null, fuelType: 'electric' as const, capacityWeight: '50', capacityCount: 8 },
  ];
}

export function generateDemoDriverNames(): string[] {
  const names: string[] = [];
  const usedPairs = new Set<string>();
  while (names.length < 5) {
    const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
    const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
    const pair = `${first} ${last}`;
    if (!usedPairs.has(pair)) {
      usedPairs.add(pair);
      names.push(pair);
    }
  }
  return names;
}

function todayAt(hour: number, minute: number = 0): Date {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d;
}

export function generateDemoOrders() {
  const count = 15 + Math.floor(Math.random() * 6); // 15-20
  const statuses = ['received', 'assigned', 'in_transit', 'delivered', 'delivered', 'failed'] as const;
  const shuffledLocs = [...BAY_AREA_LOCATIONS].sort(() => Math.random() - 0.5);

  return Array.from({ length: count }, (_, i) => {
    const loc = shuffledLocs[i % shuffledLocs.length];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const hour = 7 + Math.floor(Math.random() * 10); // 7am-5pm

    return {
      recipientName: RECIPIENT_NAMES[i % RECIPIENT_NAMES.length],
      recipientPhone: `555-${String(1000 + i).slice(-4)}`,
      deliveryAddress: { formatted: loc.name },
      deliveryLat: String(loc.lat + (Math.random() - 0.5) * 0.005),
      deliveryLng: String(loc.lng + (Math.random() - 0.5) * 0.005),
      status,
      priority: 'normal' as const,
      packageCount: 1 + Math.floor(Math.random() * 3),
      notes: i % 4 === 0 ? 'Leave at door' : null,
      createdAt: todayAt(hour, Math.floor(Math.random() * 60)),
      completedAt: status === 'delivered' ? todayAt(hour + 1 + Math.floor(Math.random() * 2)) : null,
    };
  });
}

export async function seedDemoOrg(tenantId: string): Promise<void> {
  // 1. Create vehicles
  const vehicleData = generateDemoVehicles();
  const createdVehicles = await db.insert(vehicles)
    .values(vehicleData.map(v => ({ ...v, tenantId })))
    .returning({ id: vehicles.id });

  // 2. Create drivers with scattered Bay Area locations
  const driverNames = generateDemoDriverNames();
  const driverStatuses = ['available', 'on_route', 'on_route', 'available', 'on_break'] as const;
  const driverLocations = [...BAY_AREA_LOCATIONS].sort(() => Math.random() - 0.5).slice(0, 5);

  const createdDrivers = await db.insert(drivers)
    .values(driverNames.map((name, i) => ({
      tenantId,
      name,
      email: `${name.toLowerCase().replace(' ', '.')}@demo.homer.io`,
      phone: `555-${String(2000 + i).slice(-4)}`,
      status: driverStatuses[i],
      currentVehicleId: i < createdVehicles.length ? createdVehicles[i].id : null,
      currentLat: String(driverLocations[i].lat + (Math.random() - 0.5) * 0.01),
      currentLng: String(driverLocations[i].lng + (Math.random() - 0.5) * 0.01),
      lastLocationAt: new Date(),
    })))
    .returning({ id: drivers.id });

  // 3. Create orders
  const orderData = generateDemoOrders();
  const createdOrders = await db.insert(orders)
    .values(orderData.map(o => ({ ...o, tenantId })))
    .returning({ id: orders.id, status: orders.status });

  // 4. Create routes — one completed, one in-progress, one draft
  const assignedOrders = createdOrders.filter(o => o.status !== 'received');
  const receivedOrders = createdOrders.filter(o => o.status === 'received');

  const routeDefs = [
    {
      name: 'Morning — Downtown SF',
      status: 'completed' as const,
      driverId: createdDrivers[0]?.id,
      vehicleId: createdVehicles[0]?.id,
      depotLat: '37.7749', depotLng: '-122.4194',
      depotAddress: { formatted: '100 Spear St, San Francisco' },
      plannedStartAt: todayAt(7),
      actualStartAt: todayAt(7, 12),
      actualEndAt: todayAt(11, 45),
      orderIds: assignedOrders.slice(0, 5).map(o => o.id),
    },
    {
      name: 'Midday — East Bay',
      status: 'in_progress' as const,
      driverId: createdDrivers[1]?.id,
      vehicleId: createdVehicles[1]?.id,
      depotLat: '37.8044', depotLng: '-122.2712',
      depotAddress: { formatted: '1 Kaiser Plaza, Oakland' },
      plannedStartAt: todayAt(11),
      actualStartAt: todayAt(11, 5),
      orderIds: assignedOrders.slice(5, 10).map(o => o.id),
    },
    {
      name: 'Afternoon — Peninsula',
      status: 'draft' as const,
      driverId: null,
      vehicleId: null,
      depotLat: '37.4419', depotLng: '-122.1430',
      depotAddress: { formatted: '250 University Ave, Palo Alto' },
      plannedStartAt: todayAt(14),
      orderIds: receivedOrders.slice(0, 5).map(o => o.id),
    },
  ];

  for (const def of routeDefs) {
    const { orderIds } = def;
    const totalStops = orderIds.length;
    const completedStops = def.status === 'completed' ? totalStops :
      def.status === 'in_progress' ? Math.floor(totalStops * 0.4) : 0;

    const [route] = await db.insert(routes).values({
      tenantId,
      name: def.name,
      status: def.status,
      driverId: def.driverId,
      vehicleId: def.vehicleId,
      depotAddress: def.depotAddress,
      depotLat: def.depotLat,
      depotLng: def.depotLng,
      plannedStartAt: def.plannedStartAt,
      actualStartAt: def.actualStartAt || null,
      actualEndAt: def.actualEndAt || null,
      totalStops,
      completedStops,
    }).returning({ id: routes.id });

    // Assign orders to route
    for (let i = 0; i < orderIds.length; i++) {
      await db.update(orders).set({
        routeId: route.id,
        stopSequence: i + 1,
      }).where(eq(orders.id, orderIds[i]));
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/api && npx vitest run src/__tests__/demo-seed.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/modules/auth/demo-seed.ts packages/api/src/__tests__/demo-seed.test.ts
git commit -m "feat(auth): add demo org seed generator with Bay Area data"
```

---

## Task 6: Email Linking Service

**Files:**
- Create: `packages/api/src/modules/auth/email-link.ts`
- Test: `packages/api/src/__tests__/email-link.test.ts`

- [ ] **Step 1: Write tests for email linking**

Create `packages/api/src/__tests__/email-link.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { extractDomain, isGenericDomain } from '../modules/auth/domain.js';

describe('Email linking - validation', () => {
  it('rejects linking to a generic email domain', () => {
    expect(isGenericDomain('gmail.com')).toBe(true);
    expect(isGenericDomain('yahoo.com')).toBe(true);
  });

  it('accepts work email domains for linking', () => {
    expect(isGenericDomain('acme.com')).toBe(false);
    expect(isGenericDomain('logistics-co.com')).toBe(false);
  });

  it('extracts domain correctly for link verification', () => {
    expect(extractDomain('jane@acme.com')).toBe('acme.com');
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `cd packages/api && npx vitest run src/__tests__/email-link.test.ts`
Expected: PASS (these test domain utilities which already exist)

- [ ] **Step 3: Implement email-link.ts**

Create `packages/api/src/modules/auth/email-link.ts`:

```typescript
import { FastifyInstance } from 'fastify';
import { eq, sql } from 'drizzle-orm';
import { randomBytes, createHash } from 'crypto';
import { db } from '../../lib/db/index.js';
import { users } from '../../lib/db/schema/users.js';
import { extractDomain, isGenericDomain, findTenantByDomain } from './domain.js';
import { sendTransactionalEmail } from '../../lib/email.js';
import { config } from '../../config.js';
import { HttpError } from '../../lib/errors.js';

const LINK_TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function requestEmailLink(
  app: FastifyInstance,
  userId: string,
  workEmail: string,
): Promise<{ success: boolean; message: string }> {
  const domain = extractDomain(workEmail);

  if (isGenericDomain(domain)) {
    throw new HttpError(400, 'Please use a work email address, not a personal email provider');
  }

  // Check if this work email is already taken by another user
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, workEmail.toLowerCase()))
    .limit(1);

  if (existing && existing.id !== userId) {
    throw app.httpErrors.conflict('This email is already associated with another account');
  }

  const token = randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = Date.now() + LINK_TOKEN_EXPIRY_MS;

  // Store token with expiry and work email (format: link:<hash>:<email>:<expiresAt>)
  await db.update(users).set({
    emailVerificationToken: `link:${tokenHash}:${workEmail.toLowerCase()}:${expiresAt}`,
    updatedAt: new Date(),
  }).where(eq(users.id, userId));

  await sendTransactionalEmail(
    workEmail,
    'Link your work email to HOMER.io',
    `<h2>Link your work email</h2>
    <p>Someone requested to link this email address to their HOMER.io account.</p>
    <p>Click <a href="${config.app.frontendUrl}/verify-email-link?token=${token}">here</a> to confirm. This link expires in 24 hours.</p>
    <p>If you didn't request this, you can safely ignore this email.</p>`,
  );

  return { success: true, message: 'Verification email sent to your work address' };
}

export async function verifyEmailLink(
  app: FastifyInstance,
  token: string,
): Promise<{ success: boolean; joined: boolean; tenantName?: string }> {
  const tokenHash = hashToken(token);

  // Find user with this link token using SQL LIKE (avoids full table scan)
  const [user] = await db.select().from(users)
    .where(sql`${users.emailVerificationToken} LIKE ${`link:${tokenHash}:%`}`)
    .limit(1);

  if (!user || !user.emailVerificationToken) {
    throw new HttpError(400, 'Invalid or expired link token');
  }

  // Parse stored token: link:<hash>:<email>:<expiresAt>
  const parts = user.emailVerificationToken.split(':');
  const workEmail = parts[2];
  const expiresAt = Number(parts[3]);

  if (Date.now() > expiresAt) {
    // Clean up expired token
    await db.update(users).set({ emailVerificationToken: null }).where(eq(users.id, user.id));
    throw new HttpError(400, 'Link token has expired. Please request a new one.');
  }

  const domain = extractDomain(workEmail);
  const matchingTenant = await findTenantByDomain(domain);

  if (matchingTenant && matchingTenant.id !== user.tenantId) {
    // Migrate user to the matching tenant
    await db.update(users).set({
      tenantId: matchingTenant.id,
      email: workEmail,
      role: 'dispatcher',
      emailVerificationToken: null,
      emailVerified: true,
      updatedAt: new Date(),
    }).where(eq(users.id, user.id));

    return { success: true, joined: true, tenantName: matchingTenant.name };
  }

  // No matching org — just update the email
  await db.update(users).set({
    email: workEmail,
    emailVerificationToken: null,
    emailVerified: true,
    updatedAt: new Date(),
  }).where(eq(users.id, user.id));

  return { success: true, joined: false };
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/modules/auth/email-link.ts packages/api/src/__tests__/email-link.test.ts
git commit -m "feat(auth): add email linking service for work email migration"
```

---

## Task 7: API Routes for Google Auth + Email Link

**Files:**
- Modify: `packages/api/src/modules/auth/routes.ts`

- [ ] **Step 1: Write schema validation tests**

Append to `packages/api/src/__tests__/google-auth.test.ts`:

```typescript
describe('Google Auth - Route schemas', () => {
  it('validates googleAuthSchema', async () => {
    const { googleAuthSchema } = await import('@homer-io/shared');
    expect(() => googleAuthSchema.parse({ credential: '' })).toThrow();
    expect(() => googleAuthSchema.parse({ credential: 'valid-token' })).not.toThrow();
  });

  it('validates orgChoiceSchema', async () => {
    const { orgChoiceSchema } = await import('@homer-io/shared');
    expect(() => orgChoiceSchema.parse({
      credential: 'token',
      choice: 'fresh',
      orgName: 'My Org',
    })).not.toThrow();

    expect(() => orgChoiceSchema.parse({
      credential: 'token',
      choice: 'join',
    })).not.toThrow();

    expect(() => orgChoiceSchema.parse({
      credential: 'token',
      choice: 'invalid',
    })).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `cd packages/api && npx vitest run src/__tests__/google-auth.test.ts`
Expected: PASS

- [ ] **Step 3: Add Google auth routes with rate limiting**

In `packages/api/src/modules/auth/routes.ts`, add the imports at the top:

```typescript
import { googleAuthSchema, orgChoiceSchema, emailLinkRequestSchema, emailLinkVerifySchema } from '@homer-io/shared';
import { googleAuth, googleOrgChoice } from './google.js';
import { requestEmailLink, verifyEmailLink } from './email-link.js';
```

Add these routes inside the `authRoutes` function, after the existing routes:

```typescript
  app.post('/google', async (request, reply) => {
    const body = googleAuthSchema.parse(request.body);
    const result = await googleAuth(app, body);
    reply.send(result);
  });

  app.post('/google/org-choice', async (request, reply) => {
    const body = orgChoiceSchema.parse(request.body);
    const result = await googleOrgChoice(app, body);
    reply.code(201).send(result);
  });

  app.post('/email-link/request', { preHandler: [authenticate] }, async (request, reply) => {
    const body = emailLinkRequestSchema.parse(request.body);
    const result = await requestEmailLink(app, request.user.id, body.workEmail);
    reply.send(result);
  });

  app.post('/email-link/verify', async (request, reply) => {
    const body = emailLinkVerifySchema.parse(request.body);
    const result = await verifyEmailLink(app, body.token);
    reply.send(result);
  });
```

Note: These routes inherit the auth scope rate limit (10/min) from `server.ts` since they're registered under the `/auth` prefix. The `/google/org-choice` endpoint creates tenants (expensive), but 10/min is reasonable given Google token verification is the bottleneck.

- [ ] **Step 4: Run all auth tests**

Run: `cd packages/api && npx vitest run src/__tests__/auth.test.ts src/__tests__/google-auth.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/modules/auth/routes.ts
git commit -m "feat(auth): register Google OAuth and email-link API routes"
```

---

## Task 8: Update Register Service to Set Org Domain

**Files:**
- Modify: `packages/api/src/modules/auth/service.ts`

- [ ] **Step 1: Update register function to set orgDomain**

In `packages/api/src/modules/auth/service.ts`, add import at top:

```typescript
import { extractDomain, isGenericDomain } from './domain.js';
```

In the `register` function, update the tenant insert to include domain:

```typescript
const domain = extractDomain(input.email);
const [tenant] = await tx
  .insert(tenants)
  .values({
    name: input.orgName,
    slug: slugify(input.orgName),
    orgDomain: isGenericDomain(domain) ? null : domain,
  })
  .returning();
```

- [ ] **Step 2: Run existing auth tests**

Run: `cd packages/api && npx vitest run src/__tests__/auth.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/modules/auth/service.ts
git commit -m "feat(auth): set org domain on tenant during registration"
```

---

## Task 9: Frontend — Google Sign-In Button Component

**Files:**
- Create: `packages/web/src/components/GoogleSignInButton.tsx`
- Modify: `packages/web/package.json`

- [ ] **Step 1: Install @react-oauth/google**

Run: `cd packages/web && npm install @react-oauth/google`

- [ ] **Step 2: Create GoogleSignInButton component**

Create `packages/web/src/components/GoogleSignInButton.tsx`:

```tsx
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';

interface GoogleSignInButtonProps {
  onSuccess: (credential: string) => void;
  onError?: (error: string) => void;
  text?: 'signin_with' | 'signup_with' | 'continue_with';
}

export function GoogleSignInButton({ onSuccess, onError, text = 'continue_with' }: GoogleSignInButtonProps) {
  function handleSuccess(response: CredentialResponse) {
    if (response.credential) {
      onSuccess(response.credential);
    } else {
      onError?.('No credential received from Google');
    }
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <GoogleLogin
        onSuccess={handleSuccess}
        onError={() => onError?.('Google sign-in was cancelled')}
        text={text}
        width="100%"
        shape="rectangular"
        theme="outline"
      />
    </div>
  );
}
```

This uses Google's own rendered button (`GoogleLogin` component) which returns an ID token (credential) — not an access token. The ID token is verified server-side with audience check, preventing token substitution attacks.

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/components/GoogleSignInButton.tsx packages/web/package.json package-lock.json
git commit -m "feat(web): add Google sign-in button component"
```

---

## Task 10: Frontend — Update Login & Register Pages

**Files:**
- Modify: `packages/web/src/pages/Login.tsx`
- Modify: `packages/web/src/pages/Register.tsx`
- Modify: `packages/web/src/stores/auth.ts`

- [ ] **Step 1: Update auth store with pending Google user state**

In `packages/web/src/stores/auth.ts`, update the interface and store. Exclude `pendingGoogleUser` from localStorage persistence using `partialize`:

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserResponse, AuthResponse, OrgOption } from '@homer-io/shared';

interface PendingGoogleUser {
  credential: string;
  email: string;
  name: string;
  orgOptions: OrgOption[];
}

interface AuthState {
  user: UserResponse | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  pendingGoogleUser: PendingGoogleUser | null;
  setAuth: (response: AuthResponse) => void;
  setPendingGoogleUser: (pending: PendingGoogleUser | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      pendingGoogleUser: null,
      setAuth: (response: AuthResponse) =>
        set({
          user: response.user,
          accessToken: response.accessToken,
          refreshToken: response.refreshToken,
          isAuthenticated: true,
          pendingGoogleUser: null,
        }),
      setPendingGoogleUser: (pending: PendingGoogleUser | null) =>
        set({ pendingGoogleUser: pending }),
      logout: () =>
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          pendingGoogleUser: null,
        }),
    }),
    {
      name: 'homer-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
        // pendingGoogleUser excluded — contains credential, should not persist
      }),
    },
  ),
);
```

- [ ] **Step 2: Update Login page**

Replace `packages/web/src/pages/Login.tsx`:

```tsx
import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../stores/auth.js';
import { api } from '../api/client.js';
import { GoogleSignInButton } from '../components/GoogleSignInButton.js';
import type { AuthResponse, GoogleAuthResponse } from '@homer-io/shared';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);
  const setPendingGoogleUser = useAuthStore((s) => s.setPendingGoogleUser);
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post<AuthResponse>('/auth/login', { email, password });
      setAuth(res);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSuccess(credential: string) {
    setError('');
    try {
      const res = await api.post<GoogleAuthResponse>('/auth/google', { credential });
      if (res.status === 'existing_user' && res.auth) {
        setAuth(res.auth);
        navigate('/dashboard');
      } else if (res.status === 'new_user') {
        setPendingGoogleUser({
          credential,
          email: res.googleEmail!,
          name: res.googleName!,
          orgOptions: res.orgOptions || [],
        });
        navigate('/org-choice');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed');
    }
  }

  return (
    <div className="auth-page">
      <form onSubmit={handleSubmit} className="auth-card">
        <h1>HOMER<span className="dot">.</span></h1>
        <p className="subtitle">Sign in to your account</p>

        {error && <div className="error-box">{error}</div>}

        <GoogleSignInButton
          onSuccess={handleGoogleSuccess}
          onError={setError}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0' }}>
          <hr style={{ flex: 1, border: 'none', borderTop: '1px solid #e0e0e0' }} />
          <span style={{ color: '#888', fontSize: 13 }}>or</span>
          <hr style={{ flex: 1, border: 'none', borderTop: '1px solid #e0e0e0' }} />
        </div>

        <label>
          <span>Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            required autoFocus />
        </label>

        <label>
          <span>Password</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            required />
        </label>

        <div style={{ textAlign: 'right', marginTop: -8, marginBottom: 16 }}>
          <Link to="/forgot-password">Forgot password?</Link>
        </div>

        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? 'Signing in...' : 'Sign In'}
        </button>

        <p className="footer-text">
          Don't have an account?{' '}
          <Link to="/register">Create one</Link>
        </p>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Update Register page**

Replace `packages/web/src/pages/Register.tsx`:

```tsx
import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../stores/auth.js';
import { api } from '../api/client.js';
import { GoogleSignInButton } from '../components/GoogleSignInButton.js';
import type { AuthResponse, GoogleAuthResponse } from '@homer-io/shared';

export function RegisterPage() {
  const [name, setName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);
  const setPendingGoogleUser = useAuthStore((s) => s.setPendingGoogleUser);
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post<AuthResponse>('/auth/register', {
        name, orgName, email, password,
      });
      setAuth(res);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSuccess(credential: string) {
    setError('');
    try {
      const res = await api.post<GoogleAuthResponse>('/auth/google', { credential });
      if (res.status === 'existing_user' && res.auth) {
        setAuth(res.auth);
        navigate('/dashboard');
      } else if (res.status === 'new_user') {
        setPendingGoogleUser({
          credential,
          email: res.googleEmail!,
          name: res.googleName!,
          orgOptions: res.orgOptions || [],
        });
        navigate('/org-choice');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed');
    }
  }

  return (
    <div className="auth-page">
      <form onSubmit={handleSubmit} className="auth-card">
        <h1>HOMER<span className="dot">.</span></h1>
        <p className="subtitle">Create your account</p>

        {error && <div className="error-box">{error}</div>}

        <GoogleSignInButton
          onSuccess={handleGoogleSuccess}
          onError={setError}
          text="signup_with"
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0' }}>
          <hr style={{ flex: 1, border: 'none', borderTop: '1px solid #e0e0e0' }} />
          <span style={{ color: '#888', fontSize: 13 }}>or</span>
          <hr style={{ flex: 1, border: 'none', borderTop: '1px solid #e0e0e0' }} />
        </div>

        <label>
          <span>Your Name</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)}
            required autoFocus />
        </label>

        <label>
          <span>Organization Name</span>
          <input type="text" value={orgName} onChange={(e) => setOrgName(e.target.value)}
            required />
        </label>

        <label>
          <span>Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            required />
        </label>

        <label>
          <span>Password</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            required minLength={8} />
        </label>

        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? 'Creating account...' : 'Create Account'}
        </button>

        <p className="footer-text">
          Already have an account?{' '}
          <Link to="/login">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/pages/Login.tsx packages/web/src/pages/Register.tsx packages/web/src/stores/auth.ts
git commit -m "feat(web): add Google sign-in to login and register pages"
```

---

## Task 11: Frontend — Org Choice Page + App Routing

**Files:**
- Create: `packages/web/src/pages/OrgChoice.tsx`
- Modify: `packages/web/src/App.tsx`

- [ ] **Step 1: Create OrgChoice page**

Create `packages/web/src/pages/OrgChoice.tsx`:

```tsx
import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth.js';
import { api } from '../api/client.js';
import type { GoogleAuthResponse } from '@homer-io/shared';

export function OrgChoicePage() {
  const pendingGoogleUser = useAuthStore((s) => s.pendingGoogleUser);
  const setAuth = useAuthStore((s) => s.setAuth);
  const [orgName, setOrgName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState('');
  const navigate = useNavigate();

  if (!pendingGoogleUser) {
    return <Navigate to="/login" replace />;
  }

  const joinOption = pendingGoogleUser.orgOptions.find(o => o.type === 'join');

  async function handleChoice(choice: 'join' | 'fresh' | 'demo') {
    setError('');
    setLoading(choice);

    if (choice === 'fresh' && !orgName.trim()) {
      setError('Please enter an organization name');
      setLoading('');
      return;
    }

    try {
      const res = await api.post<GoogleAuthResponse>('/auth/google/org-choice', {
        credential: pendingGoogleUser!.credential,
        choice,
        orgName: choice === 'demo' ? `${pendingGoogleUser!.name}'s Demo` : orgName || undefined,
      });
      if (res.auth) {
        setAuth(res.auth);
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoading('');
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 480 }}>
        <h1>HOMER<span className="dot">.</span></h1>
        <p className="subtitle">Welcome, {pendingGoogleUser.name}!</p>
        <p style={{ color: '#666', fontSize: 14, marginBottom: 24 }}>
          How would you like to get started?
        </p>

        {error && <div className="error-box">{error}</div>}

        {joinOption && (
          <button
            type="button"
            onClick={() => handleChoice('join')}
            disabled={!!loading}
            className="btn-primary"
            style={{ marginBottom: 12 }}
          >
            {loading === 'join' ? 'Joining...' : `Join ${joinOption.tenantName}`}
          </button>
        )}

        <div style={{ marginBottom: 12 }}>
          <label>
            <span>Organization Name</span>
            <input
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="e.g. Bay Area Courier Co."
            />
          </label>
          <button
            type="button"
            onClick={() => handleChoice('fresh')}
            disabled={!!loading}
            className="btn-primary"
            style={{ marginTop: 8, background: '#333' }}
          >
            {loading === 'fresh' ? 'Creating...' : 'Start fresh'}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0' }}>
          <hr style={{ flex: 1, border: 'none', borderTop: '1px solid #e0e0e0' }} />
          <span style={{ color: '#888', fontSize: 13 }}>or</span>
          <hr style={{ flex: 1, border: 'none', borderTop: '1px solid #e0e0e0' }} />
        </div>

        <button
          type="button"
          onClick={() => handleChoice('demo')}
          disabled={!!loading}
          style={{
            width: '100%',
            padding: '10px 16px',
            border: '1px solid #dadce0',
            borderRadius: 8,
            background: '#f8f9fa',
            color: '#3c4043',
            fontSize: 14,
            fontWeight: 500,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading === 'demo' ? 'Setting up demo...' : 'Explore with demo data'}
        </button>
        <p style={{ color: '#888', fontSize: 12, marginTop: 8, textAlign: 'center' }}>
          Get a pre-loaded Bay Area courier fleet to play with
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add route and GoogleOAuthProvider to App.tsx**

In `packages/web/src/App.tsx`, add imports:

```typescript
import { GoogleOAuthProvider } from '@react-oauth/google';
import { OrgChoicePage } from './pages/OrgChoice.js';
```

Wrap the outer `<div>` in a `GoogleOAuthProvider`:

```tsx
export function App() {
  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || ''}>
      <div style={{
        minHeight: '100vh',
        background: C.bg,
        color: C.text,
        fontFamily: F.body,
      }}>
        <Routes>
          {/* ... existing routes ... */}
```

Add the org-choice route after `/verify-email`:

```tsx
<Route path="/org-choice" element={<OrgChoicePage />} />
```

Close the `GoogleOAuthProvider`:

```tsx
      </div>
    </GoogleOAuthProvider>
  );
}
```

- [ ] **Step 3: Add VITE_GOOGLE_CLIENT_ID to web .env**

In `packages/web/.env`, add:

```
VITE_GOOGLE_CLIENT_ID=
```

- [ ] **Step 4: Run frontend build to check for type errors**

Run: `cd packages/web && npx tsc --noEmit`
Expected: No errors (or only pre-existing ones)

- [ ] **Step 5: Commit**

```bash
git add packages/web/
git commit -m "feat(web): add org choice page and GoogleOAuthProvider wrapper"
```

---

## Task 12: Update ARCHITECTURE.md

**Files:**
- Modify: `ARCHITECTURE.md`

- [ ] **Step 1: Update Authentication Flow section**

Replace the "Authentication Flow" section in `ARCHITECTURE.md` with:

```markdown
## Authentication Flow

### Email/Password
1. Register → creates tenant (with domain auto-join) + user → returns JWT + refresh token
2. Login → validates credentials → returns JWT (15min) + refresh token (7d)
3. API requests include `Authorization: Bearer <jwt>`
4. On 401, client auto-refreshes using refresh token (rotation)
5. Roles enforced via `requireRole()` middleware

### Google OAuth
1. Frontend shows Google's sign-in button via `@react-oauth/google` (`GoogleLogin` component)
2. Google returns an ID token (credential) to the frontend
3. Frontend sends credential to `POST /api/auth/google`
4. Backend verifies ID token via `google-auth-library` `verifyIdToken` with audience check
5. If existing user (by googleId or email match) → returns JWT + refresh token
6. If new user → returns org options: join existing org (domain match), start fresh, or explore demo
7. Frontend shows OrgChoicePage → user picks → `POST /api/auth/google/org-choice`
8. Backend creates tenant + user (or joins existing tenant), seeds demo data if requested

### Domain Auto-Join
- On registration/Google sign-up, org domain extracted from email
- Generic domains (gmail, yahoo, etc.) are excluded
- First user from a domain becomes owner; subsequent users auto-join as dispatcher
- Auto-join can be disabled per tenant via `autoJoinEnabled` setting

### Email Linking
- Users who signed up with a personal email can link a work email
- `POST /api/auth/email-link/request` sends verification to work email (24h expiry)
- On verification, if work email domain matches an existing tenant with auto-join, user is migrated to that org
```

- [ ] **Step 2: Update API routes section**

Add to the "Auth & Identity" API routes:

```markdown
- `POST /api/auth/google` — Google OAuth sign-in (returns JWT or org options)
- `POST /api/auth/google/org-choice` — Complete Google sign-up with org selection
- `POST /api/auth/email-link/request` — Request work email link (authenticated)
- `POST /api/auth/email-link/verify` — Verify work email link token
```

- [ ] **Step 3: Commit**

```bash
git add ARCHITECTURE.md
git commit -m "docs: update architecture with Google OAuth, domain auto-join, and email linking"
```

---

## Task 13: Run Full Test Suite + Migration

- [ ] **Step 1: Run all API tests**

Run: `cd packages/api && npm test`
Expected: All tests pass

- [ ] **Step 2: Run all shared tests**

Run: `cd packages/shared && npm test`
Expected: All tests pass

- [ ] **Step 3: Run all web tests**

Run: `cd packages/web && npm test`
Expected: All tests pass

- [ ] **Step 4: Build all packages**

Run: `npx turbo build`
Expected: Clean build with no errors

- [ ] **Step 5: Run database migration on server**

Run: `cd packages/api && npm run db:migrate:run`
Expected: Migration applies cleanly (adds `google_id`, `avatar_url` to users; `org_domain`, `auto_join_enabled`, `is_demo` to tenants)

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: V2 auth — Google OAuth, domain auto-join, demo seeding, email linking"
```
