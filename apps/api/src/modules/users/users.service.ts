import { ROLES } from '@growspark/shared';
import type {
  CreateUserInput,
  UpdateUserInput,
  ListUsersQuery,
  UserResponse,
} from '@growspark/shared';
import { prisma } from '../../db/prisma.js';
import { ApiError } from '../../middleware/error-handler.js';
import { scoped } from '../../lib/scoped.js';
import { writeAudit } from '../../lib/audit.js';
import { hashPassword } from '../../lib/password.js';
import { toSharedRole, toPrismaRole, type RequestContext } from '../../lib/context.js';
import { toSkipTake, buildPaginationMeta } from '../../lib/pagination.js';
import type { User, Prisma } from '../../generated/prisma/client.js';

function toUserResponse(user: User): UserResponse {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: toSharedRole(user.role),
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export interface ListUsersResult {
  data: UserResponse[];
  meta: { page: number; pageSize: number; total: number };
}

export async function listUsers(ctx: RequestContext, query: ListUsersQuery): Promise<ListUsersResult> {
  const where: Prisma.UserWhereInput = {
    ...scoped(ctx),
    ...(query.role ? { role: toPrismaRole(query.role) } : {}),
    ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    ...(query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: 'insensitive' } },
            { email: { contains: query.q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const orderBy: Prisma.UserOrderByWithRelationInput = query.sort
    ? { [query.sort.field]: query.sort.direction }
    : { createdAt: 'desc' };

  const [rows, total] = await Promise.all([
    prisma.user.findMany({ where, orderBy, ...toSkipTake(query) }),
    prisma.user.count({ where }),
  ]);

  return { data: rows.map(toUserResponse), meta: buildPaginationMeta(query, total) };
}

export async function createUser(ctx: RequestContext, input: CreateUserInput): Promise<UserResponse> {
  const passwordHash = await hashPassword(input.password);

  const created = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        organizationId: ctx.orgId,
        email: input.email,
        name: input.name,
        role: toPrismaRole(input.role),
        passwordHash,
      },
    });
    await writeAudit(tx, ctx, {
      action: 'user.created',
      entityType: 'user',
      entityId: user.id,
      metadata: { email: user.email, role: user.role },
    });
    return user;
  });

  return toUserResponse(created);
}

export async function getUser(ctx: RequestContext, id: string): Promise<UserResponse> {
  const user = await prisma.user.findFirst({ where: { id, ...scoped(ctx) } });
  if (!user) {
    throw new ApiError(404, 'NOT_FOUND', 'User not found');
  }
  return toUserResponse(user);
}

/**
 * Locks every currently-active Admin row for this organisation (FOR UPDATE,
 * inside the caller's transaction) and refuses if `target` is one of them
 * and is the only one — i.e. the change about to happen would leave zero
 * active Admins. A no-op for anyone who isn't currently an active Admin.
 */
async function assertNotLastActiveAdmin(
  tx: Prisma.TransactionClient,
  organizationId: string,
  target: Pick<User, 'role' | 'isActive'>,
): Promise<void> {
  if (toSharedRole(target.role) !== ROLES.ADMIN || !target.isActive) {
    return;
  }

  const activeAdmins = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM users
    WHERE organization_id = ${organizationId}::uuid
      AND role = 'ADMIN'::role
      AND is_active = true
    FOR UPDATE
  `;

  if (activeAdmins.length <= 1) {
    throw new ApiError(409, 'LAST_ADMIN', 'This would leave the organisation with no active Admin.');
  }
}

export async function updateUser(
  ctx: RequestContext,
  id: string,
  input: UpdateUserInput,
): Promise<UserResponse> {
  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.user.findFirst({ where: { id, ...scoped(ctx) } });
    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', 'User not found');
    }

    const isDemotion = input.role !== undefined && input.role !== toSharedRole(existing.role);
    if (isDemotion) {
      await assertNotLastActiveAdmin(tx, ctx.orgId, existing);
    }

    const user = await tx.user.update({
      where: { id: existing.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.role !== undefined ? { role: toPrismaRole(input.role) } : {}),
      },
    });

    const nameChanged = input.name !== undefined && input.name !== existing.name;
    const roleChanged = input.role !== undefined && user.role !== existing.role;
    const changedFields: string[] = [
      ...(nameChanged ? ['name'] : []),
      ...(roleChanged ? ['role'] : []),
    ];

    if (changedFields.length > 0) {
      await writeAudit(tx, ctx, {
        action: roleChanged ? 'user.role_changed' : 'user.updated',
        entityType: 'user',
        entityId: user.id,
        // Before/after for every changed field, not just whichever one
        // decided the action name — a PATCH that changes name and role
        // together still writes a single row (D25), and that row must
        // still show what happened to both.
        metadata: {
          changedFields,
          ...(nameChanged ? { oldName: existing.name, newName: user.name } : {}),
          ...(roleChanged ? { oldRole: existing.role, newRole: user.role } : {}),
        },
      });
    }

    return user;
  });

  return toUserResponse(updated);
}

export async function deactivateUser(ctx: RequestContext, id: string): Promise<UserResponse> {
  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.user.findFirst({ where: { id, ...scoped(ctx) } });
    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', 'User not found');
    }

    await assertNotLastActiveAdmin(tx, ctx.orgId, existing);

    const user = await tx.user.update({ where: { id: existing.id }, data: { isActive: false } });
    await tx.session.deleteMany({ where: { userId: existing.id } });
    await writeAudit(tx, ctx, { action: 'user.deactivated', entityType: 'user', entityId: user.id });
    return user;
  });

  return toUserResponse(updated);
}

export async function reactivateUser(ctx: RequestContext, id: string): Promise<UserResponse> {
  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.user.findFirst({ where: { id, ...scoped(ctx) } });
    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', 'User not found');
    }

    const user = await tx.user.update({ where: { id: existing.id }, data: { isActive: true } });
    await writeAudit(tx, ctx, { action: 'user.reactivated', entityType: 'user', entityId: user.id });
    return user;
  });

  return toUserResponse(updated);
}

export async function resetUserPassword(
  ctx: RequestContext,
  id: string,
  newPassword: string,
): Promise<void> {
  const newHash = await hashPassword(newPassword);

  await prisma.$transaction(async (tx) => {
    const existing = await tx.user.findFirst({ where: { id, ...scoped(ctx) } });
    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', 'User not found');
    }

    await tx.user.update({ where: { id: existing.id }, data: { passwordHash: newHash } });
    await tx.session.deleteMany({ where: { userId: existing.id } });
    await writeAudit(tx, ctx, { action: 'user.password_reset', entityType: 'user', entityId: existing.id });
  });
}
