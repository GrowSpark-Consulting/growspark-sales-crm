import { randomUUID } from 'node:crypto';
import { hash } from '@node-rs/argon2';
import { prisma } from '../../src/db/prisma.js';
import type { User, Organization, LeadSource } from '../../src/generated/prisma/client.js';

/** Fixed, dev-only passwords — fine to hard-code, these never touch a real database. */
export const TEST_ADMIN_PASSWORD = 'Correct-Horse-Admin-1';
export const TEST_STAFF_PASSWORD = 'Correct-Horse-Staff-1';

export interface TestTenant {
  organization: Organization;
  adminUser: User;
  adminPassword: string;
  staffUser: User;
  staffPassword: string;
  leadSource: LeadSource;
}

/**
 * Creates one fully-formed organisation for a test: an Admin and a Staff user
 * (real argon2id hashes, known plaintext passwords so login/session tests can
 * authenticate), and a lead source. Every call uses fresh random names/emails,
 * so it is safe to call more than once in the same test run.
 */
export async function createTestTenant(namePrefix = 'Test Org'): Promise<TestTenant> {
  const organization = await prisma.organization.create({
    data: { name: `${namePrefix}-${randomUUID()}` },
  });

  const [adminUser, staffUser, leadSource] = await Promise.all([
    prisma.user.create({
      data: {
        organizationId: organization.id,
        email: `admin-${randomUUID()}@example.test`,
        name: 'Test Admin',
        passwordHash: await hash(TEST_ADMIN_PASSWORD),
        role: 'ADMIN',
      },
    }),
    prisma.user.create({
      data: {
        organizationId: organization.id,
        email: `staff-${randomUUID()}@example.test`,
        name: 'Test Staff',
        passwordHash: await hash(TEST_STAFF_PASSWORD),
        role: 'STAFF',
      },
    }),
    prisma.leadSource.create({
      data: { organizationId: organization.id, name: `Source-${randomUUID()}`, sortOrder: 1 },
    }),
  ]);

  return {
    organization,
    adminUser,
    adminPassword: TEST_ADMIN_PASSWORD,
    staffUser,
    staffPassword: TEST_STAFF_PASSWORD,
    leadSource,
  };
}

/** Two independent tenants, for cross-organisation data-isolation tests. */
export async function createTwoTestTenants(): Promise<[TestTenant, TestTenant]> {
  return Promise.all([createTestTenant('Org A'), createTestTenant('Org B')]);
}
