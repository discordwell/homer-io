import { randomBytes } from 'crypto';
import { eq, and, isNull } from 'drizzle-orm';
import { db } from '../../lib/db/index.js';
import { driverInvites } from '../../lib/db/schema/driver-invites.js';
import { users } from '../../lib/db/schema/users.js';
import { drivers } from '../../lib/db/schema/drivers.js';
import { tenants } from '../../lib/db/schema/tenants.js';
import { logActivity } from '../../lib/activity.js';

const DEFAULT_EXPIRY_DAYS = 7;

function generateToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Create a quick-invite token for a temp driver.
 * Returns the token and a shareable URL.
 */
export async function createDriverInvite(
  tenantId: string,
  userId: string,
  expiryDays?: number,
): Promise<{ token: string; url: string; expiresAt: string }> {
  const token = generateToken();
  const days = expiryDays ?? DEFAULT_EXPIRY_DAYS;
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  await db.insert(driverInvites).values({
    tenantId,
    token,
    createdBy: userId,
    expiresAt,
  });

  await logActivity({
    tenantId,
    userId,
    action: 'create',
    entityType: 'driver_invite',
    entityId: token,
    metadata: { expiryDays: days },
  });

  return {
    token,
    url: `https://app.homer.io/join/${token}`,
    expiresAt: expiresAt.toISOString(),
  };
}

/**
 * Redeem a quick-invite token — creates a user + driver record.
 * Minimal info required: just name and phone.
 */
export async function redeemDriverInvite(
  token: string,
  input: { name: string; phone: string },
): Promise<{ success: boolean; message: string; userId?: string; driverId?: string }> {
  // Find and validate token
  const [invite] = await db.select()
    .from(driverInvites)
    .where(and(eq(driverInvites.token, token), isNull(driverInvites.redeemedAt)))
    .limit(1);

  if (!invite) {
    return { success: false, message: 'Invalid or already used invite link' };
  }

  if (new Date() > invite.expiresAt) {
    return { success: false, message: 'This invite link has expired' };
  }

  // Get tenant info for context
  const [tenant] = await db.select({ name: tenants.name })
    .from(tenants).where(eq(tenants.id, invite.tenantId)).limit(1);

  // Create user with a generated email (temp drivers don't need real email)
  const tempEmail = `temp-${token.slice(0, 8)}@drivers.homer.io`;

  const [user] = await db.insert(users).values({
    tenantId: invite.tenantId,
    email: tempEmail,
    name: input.name,
    role: 'driver',
    emailVerified: true, // skip verification for temp drivers
    isActive: true,
  }).returning();

  // Create driver record linked to user
  const [driver] = await db.insert(drivers).values({
    tenantId: invite.tenantId,
    userId: user.id,
    name: input.name,
    phone: input.phone,
    email: tempEmail,
    status: 'available',
  }).returning();

  // Mark invite as redeemed
  await db.update(driverInvites).set({
    redeemedAt: new Date(),
    redeemedByUserId: user.id,
    redeemedByDriverId: driver.id,
  }).where(eq(driverInvites.id, invite.id));

  await logActivity({
    tenantId: invite.tenantId,
    userId: user.id,
    action: 'create',
    entityType: 'driver',
    entityId: driver.id,
    metadata: { inviteToken: token.slice(0, 8), tempDriver: true },
  });

  return {
    success: true,
    message: `Welcome to ${tenant?.name || 'the team'}! You can now log in as a driver.`,
    userId: user.id,
    driverId: driver.id,
  };
}

/**
 * List active (unredeemed, unexpired) invites for a tenant.
 */
export async function listDriverInvites(tenantId: string) {
  return db.select()
    .from(driverInvites)
    .where(eq(driverInvites.tenantId, tenantId))
    .orderBy(driverInvites.createdAt);
}

/**
 * Validate a token without redeeming it (for the join page to show tenant name).
 */
export async function validateInviteToken(token: string): Promise<{
  valid: boolean;
  tenantName?: string;
  expired?: boolean;
}> {
  const [invite] = await db.select({
    expiresAt: driverInvites.expiresAt,
    redeemedAt: driverInvites.redeemedAt,
    tenantId: driverInvites.tenantId,
  })
    .from(driverInvites)
    .where(eq(driverInvites.token, token))
    .limit(1);

  if (!invite) return { valid: false };
  if (invite.redeemedAt) return { valid: false };
  if (new Date() > invite.expiresAt) return { valid: false, expired: true };

  const [tenant] = await db.select({ name: tenants.name })
    .from(tenants).where(eq(tenants.id, invite.tenantId)).limit(1);

  return { valid: true, tenantName: tenant?.name || 'Team' };
}
