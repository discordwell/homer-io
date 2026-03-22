import { FastifyInstance } from 'fastify';
import { eq, and } from 'drizzle-orm';
import * as argon2 from 'argon2';
import { randomBytes, createHash } from 'crypto';
import type { RegisterInput, LoginInput, AuthResponse, UserResponse } from '@homer-io/shared';
import { extractDomain, isGenericDomain } from './domain.js';
import { NotFoundError, HttpError } from '../../lib/errors.js';
import { db } from '../../lib/db/index.js';
import { tenants } from '../../lib/db/schema/tenants.js';
import { users, refreshTokens } from '../../lib/db/schema/users.js';
import { passwordResetTokens } from '../../lib/db/schema/password-reset-tokens.js';
import type { JwtPayload } from '../../plugins/auth.js';
import { createStripeCustomer } from '../billing/service.js';
import { sendTransactionalEmail } from '../../lib/email.js';
import { config } from '../../config.js';

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
  const verificationToken = randomBytes(32).toString('hex');

  // Create tenant + user in transaction
  const result = await db.transaction(async (tx) => {
    const domain = extractDomain(input.email);
    const [tenant] = await tx
      .insert(tenants)
      .values({
        name: input.orgName,
        slug: slugify(input.orgName),
        orgDomain: isGenericDomain(domain) ? null : domain,
      })
      .returning();

    const [user] = await tx
      .insert(users)
      .values({
        tenantId: tenant.id,
        email: input.email.toLowerCase(),
        passwordHash,
        name: input.name,
        role: 'owner',
        emailVerified: false,
        emailVerificationToken: hashToken(verificationToken),
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

  // Send verification email (fire-and-forget)
  sendTransactionalEmail(
    input.email,
    'Verify your HOMER.io email',
    `<h2>Welcome to HOMER.io!</h2><p>Click <a href="${config.app.frontendUrl}/verify-email?token=${verificationToken}">here</a> to verify your email address.</p>`
  ).catch(err => console.error('[auth] verification email failed:', err));

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

  // Check account lockout
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new HttpError(423, 'Account locked. Try again later.');
  }

  const valid = await argon2.verify(user.passwordHash, input.password);
  if (!valid) {
    // Increment failed login attempts
    const newAttempts = (user.failedLoginAttempts || 0) + 1;
    const lockUpdate: Record<string, unknown> = {
      failedLoginAttempts: newAttempts,
      updatedAt: new Date(),
    };
    if (newAttempts >= 5) {
      lockUpdate.lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    }
    await db.update(users).set(lockUpdate).where(eq(users.id, user.id));
    throw app.httpErrors.unauthorized('Invalid email or password');
  }

  if (!user.isActive) {
    throw app.httpErrors.forbidden('Account is disabled');
  }

  // Update last login and reset failed attempts
  await db
    .update(users)
    .set({ lastLoginAt: new Date(), failedLoginAttempts: 0, lockedUntil: null })
    .where(eq(users.id, user.id));

  return generateAuthResponse(app, user);
}

export async function refreshToken(
  app: FastifyInstance,
  token: string,
): Promise<AuthResponse> {
  const tokenHash = hashToken(token);

  // Atomic delete-and-return to prevent race conditions with concurrent refresh
  const [stored] = await db
    .delete(refreshTokens)
    .where(eq(refreshTokens.tokenHash, tokenHash))
    .returning();

  if (!stored || stored.expiresAt < new Date()) {
    throw app.httpErrors.unauthorized('Invalid or expired refresh token');
  }

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
      avatarUrl: users.avatarUrl,
      isDemo: tenants.isDemo,
      industry: tenants.industry,
      settings: tenants.settings,
    })
    .from(users)
    .innerJoin(tenants, eq(users.tenantId, tenants.id))
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw new NotFoundError('User not found');
  }

  const userSettings = (user.settings ?? {}) as Record<string, unknown>;
  const enabledFeatures = Array.isArray(userSettings.enabledFeatures) ? userSettings.enabledFeatures as string[] : [];

  return {
    ...user,
    createdAt: user.createdAt.toISOString(),
    avatarUrl: user.avatarUrl || null,
    isDemo: user.isDemo,
    industry: user.industry ?? null,
    enabledFeatures,
  };
}

export async function logout(userId: string): Promise<void> {
  await db
    .delete(refreshTokens)
    .where(eq(refreshTokens.userId, userId));
}

export async function verifyEmail(token: string): Promise<{ success: boolean }> {
  const tokenHash = hashToken(token);
  const [user] = await db.select({ id: users.id }).from(users)
    .where(eq(users.emailVerificationToken, tokenHash)).limit(1);
  if (!user) throw new HttpError(400, 'Invalid verification token');
  await db.update(users).set({ emailVerified: true, emailVerificationToken: null, updatedAt: new Date() })
    .where(eq(users.id, user.id));
  return { success: true };
}

export async function resendVerification(email: string): Promise<{ success: boolean }> {
  const [user] = await db.select({ id: users.id, emailVerified: users.emailVerified })
    .from(users).where(eq(users.email, email.toLowerCase())).limit(1);
  if (user && !user.emailVerified) {
    const token = randomBytes(32).toString('hex');
    await db.update(users).set({ emailVerificationToken: hashToken(token), updatedAt: new Date() })
      .where(eq(users.id, user.id));
    sendTransactionalEmail(email, 'Verify your HOMER.io email',
      `<h2>Verify your email</h2><p>Click <a href="${config.app.frontendUrl}/verify-email?token=${token}">here</a> to verify.</p>`
    ).catch(err => console.error('[auth] resend verification failed:', err));
  }
  return { success: true }; // Always success to prevent enumeration
}

export async function requestPasswordReset(app: FastifyInstance, email: string): Promise<void> {
  const [user] = await db.select({ id: users.id }).from(users)
    .where(eq(users.email, email.toLowerCase())).limit(1);
  if (!user) return; // Silent — no enumeration
  const token = randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  await db.insert(passwordResetTokens).values({ userId: user.id, tokenHash, expiresAt });
  sendTransactionalEmail(email, 'Reset your HOMER.io password',
    `<h2>Password Reset</h2><p>Click <a href="${config.app.frontendUrl}/reset-password?token=${token}">here</a> to reset your password. This link expires in 1 hour.</p>`
  ).catch(err => console.error('[auth] password reset email failed:', err));
}

export async function resetPassword(app: FastifyInstance, token: string, newPassword: string): Promise<{ success: boolean }> {
  const tokenHash = hashToken(token);
  const [stored] = await db.select().from(passwordResetTokens)
    .where(eq(passwordResetTokens.tokenHash, tokenHash)).limit(1);
  if (!stored || stored.expiresAt < new Date() || stored.usedAt) {
    throw new HttpError(400, 'Invalid or expired reset token');
  }
  const passwordHash = await argon2.hash(newPassword);
  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash, failedLoginAttempts: 0, updatedAt: new Date() })
      .where(eq(users.id, stored.userId));
    await tx.update(passwordResetTokens).set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.id, stored.id));
  });
  return { success: true };
}

export async function generateAuthResponse(
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

  // Look up tenant flags
  const [tenant] = await db
    .select({ isDemo: tenants.isDemo, industry: tenants.industry, settings: tenants.settings })
    .from(tenants)
    .where(eq(tenants.id, user.tenantId))
    .limit(1);

  const tenantSettings = (tenant?.settings ?? {}) as Record<string, unknown>;
  const enabledFeatures = Array.isArray(tenantSettings.enabledFeatures) ? tenantSettings.enabledFeatures as string[] : [];

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
      isDemo: tenant?.isDemo ?? false,
      industry: tenant?.industry ?? null,
      enabledFeatures,
    },
  };
}
