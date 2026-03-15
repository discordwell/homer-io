import { FastifyInstance } from 'fastify';
import { eq, and } from 'drizzle-orm';
import * as argon2 from 'argon2';
import { randomBytes, createHash } from 'crypto';
import type { RegisterInput, LoginInput, AuthResponse, UserResponse } from '@homer-io/shared';
import { NotFoundError } from '../../lib/errors.js';
import { db } from '../../lib/db/index.js';
import { tenants } from '../../lib/db/schema/tenants.js';
import { users, refreshTokens } from '../../lib/db/schema/users.js';
import type { JwtPayload } from '../../plugins/auth.js';
import { createStripeCustomer } from '../billing/service.js';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50) + '-' + randomBytes(4).toString('hex');
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function register(
  app: FastifyInstance,
  input: RegisterInput,
): Promise<AuthResponse> {
  // Check if email already exists
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, input.email.toLowerCase()))
    .limit(1);

  if (existing.length > 0) {
    throw app.httpErrors.conflict('Email already registered');
  }

  const passwordHash = await argon2.hash(input.password);

  // Create tenant + user in transaction
  const result = await db.transaction(async (tx) => {
    const [tenant] = await tx
      .insert(tenants)
      .values({ name: input.orgName, slug: slugify(input.orgName) })
      .returning();

    const [user] = await tx
      .insert(users)
      .values({
        tenantId: tenant.id,
        email: input.email.toLowerCase(),
        passwordHash,
        name: input.name,
        role: 'owner',
      })
      .returning();

    return { tenant, user };
  });

  // Set up trial subscription for the new tenant
  try {
    await createStripeCustomer(result.tenant.id, input.email, input.orgName);
  } catch (err) {
    console.error('[auth] Failed to create Stripe customer during registration:', err);
    // Non-fatal — tenant can still use the app; billing can be set up later
  }

  return generateAuthResponse(app, result.user);
}

export async function login(
  app: FastifyInstance,
  input: LoginInput,
): Promise<AuthResponse> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, input.email.toLowerCase()))
    .limit(1);

  if (!user || !user.passwordHash) {
    throw app.httpErrors.unauthorized('Invalid email or password');
  }

  const valid = await argon2.verify(user.passwordHash, input.password);
  if (!valid) {
    throw app.httpErrors.unauthorized('Invalid email or password');
  }

  if (!user.isActive) {
    throw app.httpErrors.forbidden('Account is disabled');
  }

  // Update last login
  await db
    .update(users)
    .set({ lastLoginAt: new Date() })
    .where(eq(users.id, user.id));

  return generateAuthResponse(app, user);
}

export async function refreshToken(
  app: FastifyInstance,
  token: string,
): Promise<AuthResponse> {
  const tokenHash = hashToken(token);

  const [stored] = await db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, tokenHash))
    .limit(1);

  if (!stored || stored.expiresAt < new Date()) {
    // Clean up expired token if it exists
    if (stored) {
      await db.delete(refreshTokens).where(eq(refreshTokens.id, stored.id));
    }
    throw app.httpErrors.unauthorized('Invalid or expired refresh token');
  }

  // Delete used refresh token (rotation)
  await db.delete(refreshTokens).where(eq(refreshTokens.id, stored.id));

  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, stored.userId), eq(users.isActive, true)))
    .limit(1);

  if (!user) {
    throw app.httpErrors.unauthorized('User not found or disabled');
  }

  return generateAuthResponse(app, user);
}

export async function getMe(userId: string): Promise<UserResponse> {
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      tenantId: users.tenantId,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw new NotFoundError('User not found');
  }

  return {
    ...user,
    createdAt: user.createdAt.toISOString(),
  };
}

export async function logout(userId: string): Promise<void> {
  await db
    .delete(refreshTokens)
    .where(eq(refreshTokens.userId, userId));
}

async function generateAuthResponse(
  app: FastifyInstance,
  user: typeof users.$inferSelect,
): Promise<AuthResponse> {
  const payload: JwtPayload = {
    id: user.id,
    tenantId: user.tenantId,
    email: user.email,
    role: user.role,
  };

  const accessToken = app.jwt.sign(payload, { expiresIn: '15m' });

  // Generate refresh token
  const rawRefreshToken = randomBytes(48).toString('base64url');
  const tokenHash = hashToken(rawRefreshToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash,
    expiresAt,
  });

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
    },
  };
}
