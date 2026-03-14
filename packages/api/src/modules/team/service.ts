import { eq, and } from 'drizzle-orm';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import type { InviteUserInput, Role } from '@homer-io/shared';
import { db } from '../../lib/db/index.js';
import { users } from '../../lib/db/schema/users.js';
import { HttpError } from '../../lib/errors.js';
import { logActivity } from '../../lib/activity.js';

export async function inviteUser(
  tenantId: string,
  input: InviteUserInput,
  invitedBy?: string,
) {
  // Check if email already exists
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, input.email.toLowerCase()))
    .limit(1);

  if (existing) {
    throw new HttpError(409, 'Email already registered');
  }

  // Generate temporary password
  const tempPassword = randomBytes(12).toString('base64url');
  const passwordHash = await argon2.hash(tempPassword);

  const [user] = await db
    .insert(users)
    .values({
      tenantId,
      email: input.email.toLowerCase(),
      passwordHash,
      name: input.name,
      role: input.role,
    })
    .returning({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
    });

  await logActivity({
    tenantId,
    userId: invitedBy,
    action: 'invite',
    entityType: 'user',
    entityId: user.id,
    metadata: { email: input.email, role: input.role },
  });

  return {
    ...user,
    tempPassword,
    createdAt: user.createdAt.toISOString(),
  };
}

export async function listTeamMembers(tenantId: string) {
  const members = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      isActive: users.isActive,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.tenantId, tenantId));

  return members.map(m => ({
    ...m,
    lastLoginAt: m.lastLoginAt?.toISOString() ?? null,
    createdAt: m.createdAt.toISOString(),
  }));
}

export async function updateMemberRole(
  tenantId: string,
  userId: string,
  role: Role,
  requestingUserId: string,
) {
  if (userId === requestingUserId) {
    throw new HttpError(400, 'Cannot change your own role');
  }

  const [target] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, userId), eq(users.tenantId, tenantId)))
    .limit(1);

  if (!target) {
    throw new HttpError(404, 'User not found');
  }

  if (target.role === 'owner') {
    throw new HttpError(403, 'Cannot change the owner role');
  }

  const [updated] = await db
    .update(users)
    .set({ role, updatedAt: new Date() })
    .where(and(eq(users.id, userId), eq(users.tenantId, tenantId)))
    .returning({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
    });

  await logActivity({
    tenantId,
    userId: requestingUserId,
    action: 'update_role',
    entityType: 'user',
    entityId: userId,
    metadata: { newRole: role, previousRole: target.role },
  });

  return {
    ...updated,
    createdAt: updated.createdAt.toISOString(),
  };
}

export async function deactivateMember(
  tenantId: string,
  userId: string,
  requestingUserId: string,
) {
  if (userId === requestingUserId) {
    throw new HttpError(400, 'Cannot deactivate yourself');
  }

  const [target] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, userId), eq(users.tenantId, tenantId)))
    .limit(1);

  if (!target) {
    throw new HttpError(404, 'User not found');
  }

  if (target.role === 'owner') {
    throw new HttpError(403, 'Cannot deactivate the owner');
  }

  const [deactivated] = await db
    .update(users)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(eq(users.id, userId), eq(users.tenantId, tenantId)))
    .returning({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
    });

  await logActivity({
    tenantId,
    userId: requestingUserId,
    action: 'deactivate',
    entityType: 'user',
    entityId: userId,
  });

  return {
    ...deactivated,
    createdAt: deactivated.createdAt.toISOString(),
  };
}
