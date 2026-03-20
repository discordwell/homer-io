import { FastifyInstance } from 'fastify';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import { db } from '../../lib/db/index.js';
import { tenants } from '../../lib/db/schema/tenants.js';
import { users } from '../../lib/db/schema/users.js';
import { cacheGet, cacheSet } from '../../lib/cache.js';
import { seedDemoOrg } from './demo-seed.js';
import { generateAuthResponse } from './service.js';
import { getNearestCity } from '../../lib/geocoding.js';
import type { AuthResponse } from '@homer-io/shared';
import { eq } from 'drizzle-orm';

const demoSessionSchema = z.object({
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  city: z.string().max(100).optional(),
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
 * POST /api/auth/demo-session
 * Anonymous endpoint that creates a per-visitor demo tenant with seeded data.
 * Rate limited: 5/min per IP. Cached for 1hr to prevent refresh spam.
 */
export async function handleDemoSession(
  app: FastifyInstance,
  ip: string,
  body: z.infer<typeof demoSessionSchema>,
): Promise<AuthResponse> {
  const cacheKey = `demo:ip:${ip}`;

  // Check for existing demo session from this IP (1hr TTL)
  const cached = await cacheGet<{ tenantId: string; userId: string }>(cacheKey);
  if (cached) {
    // Verify the tenant still exists (retention job may have cleaned it up)
    const exists = await tenantExists(cached.tenantId);
    if (exists) {
      // Find the user and regenerate auth tokens
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, cached.userId))
        .limit(1);

      if (user) {
        return generateAuthResponse(app, user);
      }
    }
    // Cached tenant/user is gone — fall through to create new one
  }

  // Resolve city name for tenant naming
  const cityName = body.city
    || (body.lat != null && body.lng != null
      ? getNearestCity(body.lat, body.lng).city
      : 'Demo');

  const slug = `demo-${randomBytes(4).toString('hex')}`;
  const visitorId = randomBytes(4).toString('hex');
  const email = `visitor-${visitorId}@demo.homer.io`;

  // Create tenant + user in transaction
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

  // Cache the session mapping (1hr TTL)
  await cacheSet(cacheKey, {
    tenantId: result.tenant.id,
    userId: result.user.id,
  }, 3600);

  // Seed demo data (with location awareness if lat/lng provided)
  await seedDemoOrg(result.tenant.id, {
    lat: body.lat,
    lng: body.lng,
  });

  return generateAuthResponse(app, result.user);
}

export { demoSessionSchema };
