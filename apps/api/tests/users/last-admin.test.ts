import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';
import { createTestTenant } from '../helpers/tenant.js';
import { createSession } from '../../src/lib/session.js';
import { ALLOWED_ORIGIN, sessionCookieHeader } from '../helpers/http.js';
import { hashPassword } from '../../src/lib/password.js';
import { randomUUID } from 'node:crypto';

async function addSecondAdmin(organizationId: string) {
  return prisma.user.create({
    data: {
      organizationId,
      email: `second-admin-${randomUUID()}@example.test`,
      name: 'Second Admin',
      passwordHash: await hashPassword('irrelevant-password-1'),
      role: 'ADMIN',
    },
  });
}

describe('last-Admin protection', () => {
  it('refuses to demote the sole active Admin to Staff (409 LAST_ADMIN)', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();

    const res = await request(app)
      .patch(`/api/v1/users/${tenant.adminUser.id}`)
      .set('Origin', ALLOWED_ORIGIN)
      .set('Cookie', sessionCookieHeader(token))
      .send({ role: 'STAFF' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('LAST_ADMIN');

    const user = await prisma.user.findUniqueOrThrow({ where: { id: tenant.adminUser.id } });
    expect(user.role).toBe('ADMIN');
  });

  it('refuses to deactivate the sole active Admin (409 LAST_ADMIN)', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();

    const res = await request(app)
      .post(`/api/v1/users/${tenant.adminUser.id}/deactivate`)
      .set('Origin', ALLOWED_ORIGIN)
      .set('Cookie', sessionCookieHeader(token));

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('LAST_ADMIN');

    const user = await prisma.user.findUniqueOrThrow({ where: { id: tenant.adminUser.id } });
    expect(user.isActive).toBe(true);
  });

  it('allows demoting an Admin when another active Admin remains', async () => {
    const tenant = await createTestTenant();
    const secondAdmin = await addSecondAdmin(tenant.organization.id);
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();

    const res = await request(app)
      .patch(`/api/v1/users/${secondAdmin.id}`)
      .set('Origin', ALLOWED_ORIGIN)
      .set('Cookie', sessionCookieHeader(token))
      .send({ role: 'STAFF' });

    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe('STAFF');
  });

  it('allows deactivating an Admin when another active Admin remains', async () => {
    const tenant = await createTestTenant();
    const secondAdmin = await addSecondAdmin(tenant.organization.id);
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();

    const res = await request(app)
      .post(`/api/v1/users/${secondAdmin.id}/deactivate`)
      .set('Origin', ALLOWED_ORIGIN)
      .set('Cookie', sessionCookieHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.data.isActive).toBe(false);
  });

  it('concurrency: demoting both of exactly two active Admins at the same time, exactly one succeeds', async () => {
    const tenant = await createTestTenant();
    const secondAdmin = await addSecondAdmin(tenant.organization.id);
    const { token: tokenA } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const { token: tokenB } = await createSession(tenant.organization.id, secondAdmin.id);
    const app = createApp();

    const [resA, resB] = await Promise.all([
      request(app)
        .patch(`/api/v1/users/${tenant.adminUser.id}`)
        .set('Origin', ALLOWED_ORIGIN)
        .set('Cookie', sessionCookieHeader(tokenA))
        .send({ role: 'STAFF' }),
      request(app)
        .patch(`/api/v1/users/${secondAdmin.id}`)
        .set('Origin', ALLOWED_ORIGIN)
        .set('Cookie', sessionCookieHeader(tokenB))
        .send({ role: 'STAFF' }),
    ]);

    const statuses = [resA.status, resB.status].sort((a, b) => a - b);
    expect(statuses).toEqual([200, 409]);

    const activeAdminCount = await prisma.user.count({
      where: { organizationId: tenant.organization.id, role: 'ADMIN', isActive: true },
    });
    expect(activeAdminCount).toBe(1);
  });
});
