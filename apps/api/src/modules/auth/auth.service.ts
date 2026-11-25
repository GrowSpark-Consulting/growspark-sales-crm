import { ROLE_PERMISSIONS, type MeResponse } from '@growspark/shared';
import { prisma } from '../../db/prisma.js';
import { ApiError } from '../../middleware/error-handler.js';
import { toSharedRole, type RequestContext } from '../../lib/context.js';
import { hashPassword, verifyPassword, verifyAgainstDummyHash } from '../../lib/password.js';
import { createSession, deleteSessionByToken } from '../../lib/session.js';
import { writeAudit } from '../../lib/audit.js';
import type { Organization, User } from '../../generated/prisma/client.js';

const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password';

function buildMeResponse(user: User, organization: Organization): MeResponse {
  const role = toSharedRole(user.role);
  return {
    user: { id: user.id, email: user.email, name: user.name, role },
    organization: {
      name: organization.name,
      timezone: organization.timezone,
      currency: organization.currency,
    },
    permissions: [...ROLE_PERMISSIONS[role]],
  };
}

export interface LoginResult {
  token: string;
  me: MeResponse;
}

/**
 * Finds the user by lowercased email (the schema has already normalised
 * `email` by the time it reaches here). Email match count other than
 * exactly one, or an inactive user, is treated identically to "wrong
 * password": same generic message, and the dummy-hash verification still
 * runs so the response time does not reveal which case occurred.
 */
export async function login(email: string, password: string): Promise<LoginResult> {
  const candidates = await prisma.user.findMany({ where: { email } });
  const user = candidates.length === 1 ? candidates[0] : undefined;

  if (!user || !user.isActive) {
    await verifyAgainstDummyHash(password);
    throw new ApiError(401, 'UNAUTHENTICATED', INVALID_CREDENTIALS_MESSAGE);
  }

  const passwordMatches = await verifyPassword(user.passwordHash, password);
  if (!passwordMatches) {
    throw new ApiError(401, 'UNAUTHENTICATED', INVALID_CREDENTIALS_MESSAGE);
  }

  const [organization] = await Promise.all([
    prisma.organization.findUniqueOrThrow({ where: { id: user.organizationId } }),
    prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
  ]);

  const { token } = await createSession(user.organizationId, user.id);

  return { token, me: buildMeResponse(user, organization) };
}

export async function logout(token: string): Promise<void> {
  await deleteSessionByToken(token);
}

export async function getMe(ctx: RequestContext): Promise<MeResponse> {
  const [user, organization] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: ctx.userId } }),
    prisma.organization.findUniqueOrThrow({ where: { id: ctx.orgId } }),
  ]);
  return buildMeResponse(user, organization);
}

export interface ChangePasswordResult {
  token: string;
}

/**
 * Verifies the current password, then atomically: updates the hash, deletes
 * every one of this user's sessions, and writes the audit row. A fresh
 * session for the request that just changed the password is created after
 * that transaction commits — it is additive, not part of what must be
 * undone if anything above fails.
 */
export async function changePassword(
  ctx: RequestContext,
  currentPassword: string,
  newPassword: string,
): Promise<ChangePasswordResult> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: ctx.userId } });

  const matches = await verifyPassword(user.passwordHash, currentPassword);
  if (!matches) {
    // 422 with a field error, never 401: the web app treats any 401 as an
    // expired session and signs the user out, so a typo here would log them
    // out (D93).
    throw new ApiError(422, 'VALIDATION_FAILED', 'Current password is incorrect', [
      { path: 'currentPassword', message: 'Current password is incorrect' },
    ]);
  }

  const newHash = await hashPassword(newPassword);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { passwordHash: newHash } });
    await tx.session.deleteMany({ where: { userId: user.id } });
    await writeAudit(tx, ctx, {
      action: 'user.password_changed',
      entityType: 'user',
      entityId: user.id,
    });
  });

  const { token } = await createSession(ctx.orgId, user.id);
  return { token };
}
