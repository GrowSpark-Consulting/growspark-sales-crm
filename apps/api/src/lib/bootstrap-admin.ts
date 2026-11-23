import { createUserSchema } from '@growspark/shared';
import { prisma } from '../db/prisma.js';
import { hashPassword } from './password.js';
import { isKnownRequestError, PRISMA_ERROR } from './prisma-errors.js';
import type { User } from '../generated/prisma/client.js';

export interface CreateFirstAdminInput {
  organizationId: string;
  name: string;
  email: string;
  password: string;
}

/**
 * Creates an Admin user outside the normal authenticated request path — for
 * the staging bootstrap script (scripts/staging-create-admin.ts), where
 * there is no existing user to be the audit actor. The new user is recorded
 * as its own audit actor (it audits its own creation), the only sensible
 * choice for the very first account in a brand-new organisation — the same
 * reasoning that already applies to every other business record in this
 * app, which never has a null actor.
 */
export async function createFirstAdmin(input: CreateFirstAdminInput): Promise<User> {
  const parsed = createUserSchema.parse({
    name: input.name,
    email: input.email,
    password: input.password,
    role: 'ADMIN',
  });
  const passwordHash = await hashPassword(parsed.password);

  try {
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          organizationId: input.organizationId,
          email: parsed.email,
          name: parsed.name,
          role: 'ADMIN',
          passwordHash,
        },
      });
      await tx.auditEvent.create({
        data: {
          organizationId: input.organizationId,
          actorId: user.id,
          action: 'user.created',
          entityType: 'user',
          entityId: user.id,
          metadata: { email: user.email, role: user.role, bootstrap: true },
        },
      });
      return user;
    });
  } catch (err) {
    if (isKnownRequestError(err) && err.code === PRISMA_ERROR.UNIQUE_VIOLATION) {
      throw new Error(`A user with the email "${parsed.email}" already exists in this organisation.`, { cause: err });
    }
    throw err;
  }
}
