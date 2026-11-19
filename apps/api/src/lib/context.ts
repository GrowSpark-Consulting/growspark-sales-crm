import type { ROLES } from '@growspark/shared';
import type { Role as PrismaRole } from '../generated/prisma/client.js';

/** Every service function takes this, never raw request data. */
export interface RequestContext {
  userId: string;
  orgId: string;
  role: ROLES;
}

/**
 * Prisma generates its own `Role` enum from schema.prisma — a distinct
 * TypeScript type from `packages/shared`'s hand-written `ROLES`, even though
 * their values are identical strings ('ADMIN' | 'STAFF'). The Postgres enum
 * column guarantees only those values ever come out of the database, so this
 * cast is safe; it is a single, explicit bridge point rather than casting
 * ad hoc wherever a user row is read.
 */
export function toSharedRole(role: PrismaRole): ROLES {
  return role as unknown as ROLES;
}

/** The inverse bridge — see toSharedRole for why this cast is safe. */
export function toPrismaRole(role: ROLES): PrismaRole {
  return role as unknown as PrismaRole;
}
