import { afterAll, describe, expect, it } from 'vitest';
import { verify } from '@node-rs/argon2';
import { prisma } from '../../src/db/prisma.js';
import { runSeed } from '../../prisma/seed-lib.js';
import { assertTestDatabaseName, resetDatabase } from './reset-database.js';
import { createTestTenant, createTwoTestTenants } from './tenant.js';

describe('assertTestDatabaseName', () => {
  it('accepts a database name ending in _test', () => {
    expect(assertTestDatabaseName('postgresql://user:pass@localhost:5433/crm_test')).toBe(
      'crm_test',
    );
  });

  it('refuses a database name that does not end in _test', () => {
    expect(() =>
      assertTestDatabaseName('postgresql://user:pass@localhost:5433/crm_dev'),
    ).toThrow(/does not|refuses/i);
  });

  it('refuses a database name that only contains "test" as a substring', () => {
    expect(() =>
      assertTestDatabaseName('postgresql://user:pass@localhost:5433/crm_test_archive'),
    ).toThrow();
  });
});

describe('resetDatabase', () => {
  // Restore the documented seed baseline regardless of where this file lands
  // in suite order, so crm_test is left the way other sessions expect it.
  afterAll(async () => {
    await runSeed();
  });

  it('truncates every application table so the database starts empty', async () => {
    await createTestTenant();
    expect(await prisma.organization.count()).toBeGreaterThan(0);
    expect(await prisma.user.count()).toBeGreaterThan(0);
    expect(await prisma.leadSource.count()).toBeGreaterThan(0);

    await resetDatabase();

    expect(await prisma.organization.count()).toBe(0);
    expect(await prisma.user.count()).toBe(0);
    expect(await prisma.leadSource.count()).toBe(0);
  });
});

describe('createTestTenant', () => {
  it('creates an Admin and a Staff user whose stored hash verifies against the known password', async () => {
    const tenant = await createTestTenant();

    await expect(verify(tenant.adminUser.passwordHash, tenant.adminPassword)).resolves.toBe(
      true,
    );
    await expect(verify(tenant.staffUser.passwordHash, tenant.staffPassword)).resolves.toBe(
      true,
    );
    await expect(verify(tenant.adminUser.passwordHash, 'wrong-password')).resolves.toBe(false);

    expect(tenant.adminUser.role).toBe('ADMIN');
    expect(tenant.staffUser.role).toBe('STAFF');
    expect(tenant.adminUser.organizationId).toBe(tenant.organization.id);
  });
});

describe('createTwoTestTenants', () => {
  it('creates two distinct organisations with no overlapping users', async () => {
    const [orgA, orgB] = await createTwoTestTenants();

    expect(orgA.organization.id).not.toBe(orgB.organization.id);
    expect(orgA.adminUser.organizationId).toBe(orgA.organization.id);
    expect(orgB.adminUser.organizationId).toBe(orgB.organization.id);
    expect(orgA.adminUser.organizationId).not.toBe(orgB.adminUser.organizationId);
  });
});
