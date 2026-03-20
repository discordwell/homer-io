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

  const [user] = await db.select().from(users)
    .where(sql`${users.emailVerificationToken} LIKE ${`link:${tokenHash}:%`}`)
    .limit(1);

  if (!user || !user.emailVerificationToken) {
    throw new HttpError(400, 'Invalid or expired link token');
  }

  const parts = user.emailVerificationToken.split(':');
  const workEmail = parts[2];
  const expiresAt = Number(parts[3]);

  if (Date.now() > expiresAt) {
    await db.update(users).set({ emailVerificationToken: null }).where(eq(users.id, user.id));
    throw new HttpError(400, 'Link token has expired. Please request a new one.');
  }

  const domain = extractDomain(workEmail);
  const matchingTenant = await findTenantByDomain(domain);

  if (matchingTenant && matchingTenant.id !== user.tenantId) {
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

  await db.update(users).set({
    email: workEmail,
    emailVerificationToken: null,
    emailVerified: true,
    updatedAt: new Date(),
  }).where(eq(users.id, user.id));

  return { success: true, joined: false };
}
