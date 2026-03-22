import { FastifyInstance } from 'fastify';
import { randomBytes } from 'crypto';
import { demoSessionSchema as sharedSchema } from '@homer-io/shared';
import { z } from 'zod';
import { db } from '../../lib/db/index.js';
import { tenants } from '../../lib/db/schema/tenants.js';
import { users } from '../../lib/db/schema/users.js';
import { cacheGet, cacheSet, cacheDelete } from '../../lib/cache.js';
import { seedDemoOrg } from './demo-seed.js';
import { generateAuthResponse } from './service.js';
import { getNearestCity } from '../../lib/geocoding.js';
import { isDisposableEmail } from './disposable-domains.js';
import { HttpError } from '../../lib/errors.js';
import type { AuthResponse } from '@homer-io/shared';
import { eq, and } from 'drizzle-orm';

const DEMO_CACHE_TTL = 7 * 24 * 3600; // 7 days — matches demo tenant lifetime

// Server-side schema adds lowercase transform on top of the shared definition
const demoSessionSchema = sharedSchema.extend({
  email: sharedSchema.shape.email.transform((s) => s.toLowerCase()),
});

/**
 * Check if a tenant still exists (wasn't cleaned up by retention job).
 */
async function tenantExists(tenantId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  return !!row;
}

/**
 * Slow-path dedup: find an existing demo tenant for this email via DB.
 * The innerJoin guarantees the tenant exists, so no second tenantExists check needed.
 */
async function findDemoByEmail(email: string): Promise<{ tenantId: string; userId: string } | null> {
  const [row] = await db
    .select({ userId: users.id, tenantId: users.tenantId })
    .from(users)
    .innerJoin(tenants, eq(users.tenantId, tenants.id))
    .where(and(eq(users.email, email), eq(tenants.isDemo, true)))
    .limit(1);
  return row ? { tenantId: row.tenantId, userId: row.userId } : null;
}

/**
 * POST /api/auth/demo-session
 * Email-gated endpoint that creates a per-email demo tenant with seeded data.
 * Rate limited: 5/min per IP. Deduped by email (7-day TTL matching demo lifetime).
 *
 * Returns { isNew: boolean, auth: AuthResponse } so the route can choose 200 vs 201.
 */
export async function handleDemoSession(
  app: FastifyInstance,
  body: z.infer<typeof demoSessionSchema>,
): Promise<{ isNew: boolean; auth: AuthResponse }> {
  const { email } = body;

  // Block disposable email domains
  if (isDisposableEmail(email)) {
    throw new HttpError(422, 'Disposable email addresses are not allowed. Please use a real email address.');
  }

  const cacheKey = `demo:email:${email}`;

  // Fast path: check Redis cache for existing demo session
  const cached = await cacheGet<{ tenantId: string; userId: string }>(cacheKey);
  if (cached) {
    const exists = await tenantExists(cached.tenantId);
    if (exists) {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, cached.userId))
        .limit(1);

      if (user) {
        return { isNew: false, auth: await generateAuthResponse(app, user) };
      }
    }
    // Cached tenant/user is gone — clear stale cache entry
    await cacheDelete(cacheKey);
  }

  // Slow path: check DB for existing demo tenant (cache may have expired)
  const existing = await findDemoByEmail(email);
  if (existing) {
    // innerJoin already proved tenant exists — re-cache and return
    await cacheSet(cacheKey, existing, DEMO_CACHE_TTL);

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, existing.userId))
      .limit(1);

    if (user) {
      return { isNew: false, auth: await generateAuthResponse(app, user) };
    }
  }

  // Acquire creation lock to prevent race condition with concurrent same-email requests
  const lockKey = `demo:lock:${email}`;
  const lockAcquired = await cacheGet<boolean>(lockKey);
  if (lockAcquired) {
    throw new HttpError(409, 'Demo is being created. Please wait a moment and try again.');
  }
  await cacheSet(lockKey, true, 30); // 30s lock TTL

  try {
    // Resolve city name for tenant naming
    const cityName = body.city
      || (body.lat != null && body.lng != null
        ? getNearestCity(body.lat, body.lng).city
        : 'Demo');

    const slug = `demo-${randomBytes(4).toString('hex')}`;

    // Create tenant + user in transaction (use submitted email)
    const result = await db.transaction(async (tx) => {
      const [tenant] = await tx
        .insert(tenants)
        .values({
          name: `Demo — ${cityName}`,
          slug,
          isDemo: true,
        })
        .returning();

      const [user] = await tx
        .insert(users)
        .values({
          tenantId: tenant.id,
          email,
          name: 'Demo User',
          role: 'owner',
          emailVerified: true, // Skip verification for demo
        })
        .returning();

      return { tenant, user };
    });

    // Cache the session mapping (7-day TTL)
    await cacheSet(cacheKey, {
      tenantId: result.tenant.id,
      userId: result.user.id,
    }, DEMO_CACHE_TTL);

    // Seed demo data — if this fails, clean up the tenant + cache so retry works cleanly
    try {
      await seedDemoOrg(result.tenant.id, {
        lat: body.lat,
        lng: body.lng,
      });
    } catch (seedErr) {
      // Clean up so the user doesn't get stuck with an empty demo on retry
      await cacheDelete(cacheKey);
      await db.delete(tenants).where(eq(tenants.id, result.tenant.id));
      throw seedErr;
    }

    return { isNew: true, auth: await generateAuthResponse(app, result.user) };
  } finally {
    // Release creation lock
    await cacheDelete(lockKey);
  }
}

export { demoSessionSchema };
