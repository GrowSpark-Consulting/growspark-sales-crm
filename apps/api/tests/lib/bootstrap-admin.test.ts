import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { prisma } from '../../src/db/prisma.js';
import { verifyPassword } from '../../src/lib/password.js';
import { createFirstAdmin } from '../../src/lib/bootstrap-admin.js';
import { createTestTenant } from '../helpers/tenant.js';

describe('createFirstAdmin', () => {
  it('creates an ADMIN user with a real argon2 hash, not the plaintext password', async () => {
    const tenant = await createTestTenant();
    const email = `bootstrap-${randomUUID()}@example.test`;

    const admin = await createFirstAdmin({
      organizationId: tenant.organization.id,
      name: 'Bootstrap Admin',
      email,
      password: 'correct-horse-battery-1',
    });

    expect(admin.email).toBe(email);
    expect(admin.role).toBe('ADMIN');
    expect(admin.passwordHash).not.toBe('correct-horse-battery-1');
    expect(await verifyPassword(admin.passwordHash, 'correct-horse-battery-1')).toBe(true);
  });

  it('writes an audit row naming the new admin as its own actor', async () => {
    const tenant = await createTestTenant();
    const email = `bootstrap-${randomUUID()}@example.test`;

    const admin = await createFirstAdmin({
      organizationId: tenant.organization.id,
      name: 'Bootstrap Admin',
      email,
      password: 'correct-horse-battery-1',
    });

    const audit = await prisma.auditEvent.findFirst({
      where: { organizationId: tenant.organization.id, entityId: admin.id, action: 'user.created' },
    });
    expect(audit?.actorId).toBe(admin.id);
  });

  it('rejects a password shorter than the shared createUserSchema minimum', async () => {
    const tenant = await createTestTenant();
    await expect(
      createFirstAdmin({
        organizationId: tenant.organization.id,
        name: 'Too Short',
        email: `bootstrap-${randomUUID()}@example.test`,
        password: 'short1',
      }),
    ).rejects.toThrow();
  });

  it('gives a friendly error on a duplicate email instead of a raw Prisma error', async () => {
    const tenant = await createTestTenant();
    await expect(
      createFirstAdmin({
        organizationId: tenant.organization.id,
        name: 'Duplicate',
        email: tenant.adminUser.email,
        password: 'correct-horse-battery-1',
      }),
    ).rejects.toThrow(/already exists/);
  });
});
