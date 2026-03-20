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
import { HttpError } from '../../lib/errors.js';

const client = new OAuth2Client(config.google.clientId);

interface GoogleProfile {
  googleId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

async function verifyGoogleToken(credential: string): Promise<GoogleProfile> {
  let ticket;
  try {
    ticket = await client.verifyIdToken({
      idToken: credential,
      audience: config.google.clientId,
    });
  } catch {
    throw new HttpError(401, 'Invalid or expired Google credential');
  }
  const payload = ticket.getPayload();
  if (!payload || !payload.email) {
    throw new HttpError(401, 'Google account has no email address');
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

  createStripeCustomer(result.tenant.id, profile.email, orgName)
    .catch(err => console.error('[google-auth] Stripe customer creation failed:', err));

  if (input.choice === 'demo') {
    await seedDemoOrg(result.tenant.id);
  }

  const auth = await generateAuthResponse(app, result.user);
  return { status: 'existing_user' as const, auth };
}
