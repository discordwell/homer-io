import { FastifyInstance } from 'fastify';
import { eq, and, isNull, gt } from 'drizzle-orm';
import { randomBytes, createHash } from 'crypto';
import * as argon2 from 'argon2';
import { OAuth2Client } from 'google-auth-library';
import { db } from '../../lib/db/index.js';
import { users } from '../../lib/db/schema/users.js';
import { emailLinkTokens } from '../../lib/db/schema/email-link-tokens.js';
import { extractDomain, isGenericDomain, findTenantByDomain } from './domain.js';
import { sendTransactionalEmail } from '../../lib/email.js';
import { config } from '../../config.js';
import { HttpError } from '../../lib/errors.js';
import { logActivity } from '../../lib/activity.js';

const LINK_TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

const googleClient = new OAuth2Client(config.google.clientId);

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function requestEmailLink(
  app: FastifyInstance,
  userId: string,
  workEmail: string,
): Promise<{ success: boolean; message: string }> {
  const normalized = workEmail.toLowerCase();
  const domain = extractDomain(normalized);

  if (isGenericDomain(domain)) {
    throw new HttpError(400, 'Please use a work email address, not a personal email provider');
  }

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, normalized))
    .limit(1);

  if (existing && existing.id !== userId) {
    throw app.httpErrors.conflict('This email is already associated with another account');
  }

  const token = randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + LINK_TOKEN_EXPIRY_MS);

  await db.insert(emailLinkTokens).values({
    userId,
    tokenHash,
    workEmail: normalized,
    expiresAt,
  });

  await sendTransactionalEmail(
    normalized,
    'Link your work email to HOMER.io',
    `<h2>Link your work email</h2>
    <p>Someone requested to link this email address to their HOMER.io account.</p>
    <p>Click <a href="${config.app.frontendUrl}/verify-email-link?token=${token}">here</a> to confirm. This link expires in 24 hours.</p>
    <p>You'll be asked to re-enter your password (or sign in with Google again) to confirm the change.</p>
    <p>If you didn't request this, you can safely ignore this email.</p>`,
  );

  return { success: true, message: 'Verification email sent to your work address' };
}

/**
 * Verify the re-authentication credentials for the user whose tenant we are
 * about to potentially migrate. Exactly one of `password` or `googleCredential`
 * must be supplied; callers enforce this at the schema layer but we defend
 * here too.
 */
async function reauthenticateUser(
  user: typeof users.$inferSelect,
  credentials: { password?: string; googleCredential?: string },
): Promise<void> {
  const hasPassword = Boolean(credentials.password);
  const hasGoogle = Boolean(credentials.googleCredential);

  if (hasPassword === hasGoogle) {
    // Either both or neither — schema should have caught this.
    throw new HttpError(400, 'Provide exactly one of password or googleCredential');
  }

  if (hasPassword) {
    if (!user.passwordHash) {
      // User has no password (Google-only account). They must use Google re-auth.
      throw new HttpError(401, 'This account has no password. Re-authenticate with Google instead.');
    }
    const valid = await argon2.verify(user.passwordHash, credentials.password!);
    if (!valid) {
      throw new HttpError(401, 'Re-authentication failed');
    }
    return;
  }

  // Google re-auth path
  let ticket;
  try {
    ticket = await googleClient.verifyIdToken({
      idToken: credentials.googleCredential!,
      audience: config.google.clientId,
    });
  } catch {
    throw new HttpError(401, 'Invalid or expired Google credential');
  }
  const payload = ticket.getPayload();
  if (!payload || !payload.sub) {
    throw new HttpError(401, 'Google credential has no subject');
  }
  if (!user.googleId || user.googleId !== payload.sub) {
    // The Google account used to re-auth doesn't match the logged-in user's linked googleId.
    throw new HttpError(401, 'Google credential does not match account');
  }
}

export async function verifyEmailLink(
  app: FastifyInstance,
  token: string,
  credentials: { password?: string; googleCredential?: string },
): Promise<{ success: boolean; joined: boolean; tenantName?: string }> {
  const tokenHash = hashToken(token);
  const now = new Date();

  // Atomically consume the token. UPDATE ... WHERE used_at IS NULL AND expires_at > now()
  // RETURNING ensures concurrent verifies cannot both succeed — exactly one row is
  // returned; the other caller gets an empty result and we 400.
  const [consumed] = await db
    .update(emailLinkTokens)
    .set({ usedAt: now })
    .where(and(
      eq(emailLinkTokens.tokenHash, tokenHash),
      isNull(emailLinkTokens.usedAt),
      gt(emailLinkTokens.expiresAt, now),
    ))
    .returning();

  if (!consumed) {
    throw new HttpError(400, 'Invalid, expired, or already-used link token');
  }

  // Load the user. We deliberately do this *after* consuming the token so a
  // concurrent verify can't sneak through between the select and the consume.
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, consumed.userId))
    .limit(1);

  if (!user) {
    throw new HttpError(400, 'User for token no longer exists');
  }

  if (!user.isActive) {
    throw app.httpErrors.forbidden('Account is disabled');
  }

  // Re-authentication: the link alone is *not* sufficient to move a user into a
  // new tenant. The attacker-crafted-link takeover path dies here.
  await reauthenticateUser(user, credentials);

  const workEmail = consumed.workEmail;
  const domain = extractDomain(workEmail);
  const matchingTenant = await findTenantByDomain(domain);

  if (matchingTenant && matchingTenant.id !== user.tenantId) {
    const previousTenantId = user.tenantId;
    await db.update(users).set({
      tenantId: matchingTenant.id,
      email: workEmail,
      role: 'dispatcher',
      emailVerified: true,
      updatedAt: new Date(),
    }).where(eq(users.id, user.id));

    // Audit trail: log in *both* tenants so each side sees the move.
    try {
      await logActivity({
        tenantId: matchingTenant.id,
        userId: user.id,
        action: 'user.tenant_migrated_in',
        entityType: 'user',
        entityId: user.id,
        metadata: {
          previousTenantId,
          newTenantId: matchingTenant.id,
          workEmail,
        },
      });
      await logActivity({
        tenantId: previousTenantId,
        userId: user.id,
        action: 'user.tenant_migrated_out',
        entityType: 'user',
        entityId: user.id,
        metadata: {
          previousTenantId,
          newTenantId: matchingTenant.id,
          workEmail,
        },
      });
    } catch (err) {
      // Don't fail the migration on audit-log write failure, but log loudly.
      app.log.error({ err }, '[email-link] audit log write failed');
    }

    return { success: true, joined: true, tenantName: matchingTenant.name };
  }

  // No tenant migration — just attach the verified work email.
  await db.update(users).set({
    email: workEmail,
    emailVerified: true,
    updatedAt: new Date(),
  }).where(eq(users.id, user.id));

  return { success: true, joined: false };
}

/**
 * Invalidate all outstanding email-link tokens for a user. Called from password
 * reset so that a stolen-password reset also kills any pre-existing attacker-
 * crafted migration links.
 */
export async function invalidateEmailLinkTokensForUser(
  tx: typeof db,
  userId: string,
): Promise<void> {
  await tx
    .update(emailLinkTokens)
    .set({ usedAt: new Date() })
    .where(and(
      eq(emailLinkTokens.userId, userId),
      isNull(emailLinkTokens.usedAt),
    ));
}
