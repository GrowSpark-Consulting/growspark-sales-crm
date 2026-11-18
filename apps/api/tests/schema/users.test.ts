import { afterEach, describe, expect, it } from 'vitest';
import { prisma } from '../../src/db/prisma.js';
import {
  PG_ERROR,
  cleanupOrganization,
  createTestOrganization,
  expectRejection,
} from './helpers.js';

let organizationId: string | undefined;
let secondOrganizationId: string | undefined;

afterEach(async () => {
  if (organizationId) {
    await cleanupOrganization(organizationId);
    organizationId = undefined;
  }
  if (secondOrganizationId) {
    await cleanupOrganization(secondOrganizationId);
    secondOrganizationId = undefined;
  }
});

describe('users unique (organizationId, email)', () => {
  it('rejects a duplicate email within the same organization', async () => {
    const org = await createTestOrganization('UserDup');
    organizationId = org.id;

    await prisma.user.create({
      data: {
        organizationId: org.id,
        email: 'dup@example.test',
        name: 'First',
        passwordHash: 'hash',
        role: 'STAFF',
      },
    });

    await expectRejection(
      prisma.user.create({
        data: {
          organizationId: org.id,
          email: 'dup@example.test',
          name: 'Second',
          passwordHash: 'hash',
          role: 'STAFF',
        },
      }),
      PG_ERROR.UNIQUE_VIOLATION,
      'users_organization_id_email_key',
    );
  });

  it('accepts the same email in a different organization', async () => {
    const orgA = await createTestOrganization('UserOrgA');
    const orgB = await createTestOrganization('UserOrgB');
    organizationId = orgA.id;
    secondOrganizationId = orgB.id;

    await prisma.user.create({
      data: {
        organizationId: orgA.id,
        email: 'shared@example.test',
        name: 'In Org A',
        passwordHash: 'hash',
        role: 'STAFF',
      },
    });

    const userB = await prisma.user.create({
      data: {
        organizationId: orgB.id,
        email: 'shared@example.test',
        name: 'In Org B',
        passwordHash: 'hash',
        role: 'STAFF',
      },
    });

    expect(userB.email).toBe('shared@example.test');
  });
});

describe('users_email_lowercase CHECK', () => {
  it('rejects a user with an uppercase email', async () => {
    const org = await createTestOrganization('UserUppercase');
    organizationId = org.id;

    await expectRejection(
      prisma.user.create({
        data: {
          organizationId: org.id,
          email: 'Shouting@Example.Test',
          name: 'Shouty',
          passwordHash: 'hash',
          role: 'STAFF',
        },
      }),
      PG_ERROR.CHECK_VIOLATION,
      'users_email_lowercase',
    );
  });
});
