import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';
import { createTestTenant } from '../helpers/tenant.js';
import { createSession } from '../../src/lib/session.js';
import { ALLOWED_ORIGIN, sessionCookieHeader } from '../helpers/http.js';

describe('GET /api/v1/users — list, pagination, sort, filters', () => {
  it('paginates correctly', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();

    for (let i = 0; i < 3; i++) {
      await prisma.user.create({
        data: {
          organizationId: tenant.organization.id,
          email: `extra-${i}-${randomUUID()}@example.test`,
          name: `Extra ${i}`,
          passwordHash: 'not-a-real-hash',
          role: 'STAFF',
        },
      });
    }

    const res = await request(app)
      .get('/api/v1/users?page=1&pageSize=2')
      .set('Cookie', sessionCookieHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
    expect(res.body.meta).toEqual({ page: 1, pageSize: 2, total: 5 }); // admin + staff + 3 extra
  });

  it('rejects an unknown sort field with 422', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();

    const res = await request(app)
      .get('/api/v1/users?sort=bogus:asc')
      .set('Cookie', sessionCookieHeader(token));
    expect(res.status).toBe(422);
  });

  it('rejects a malformed sort value (missing direction) with 422', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();

    const res = await request(app).get('/api/v1/users?sort=name').set('Cookie', sessionCookieHeader(token));
    expect(res.status).toBe(422);
  });

  it('sorts by name ascending', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();

    const res = await request(app)
      .get('/api/v1/users?sort=name:asc')
      .set('Cookie', sessionCookieHeader(token));
    expect(res.status).toBe(200);
    const names = res.body.data.map((u: { name: string }) => u.name);
    expect(names).toEqual([...names].sort());
  });

  it('filters by role', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();

    const res = await request(app).get('/api/v1/users?role=ADMIN').set('Cookie', sessionCookieHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data.every((u: { role: string }) => u.role === 'ADMIN')).toBe(true);
  });

  it('filters by isActive', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();

    await request(app)
      .post(`/api/v1/users/${tenant.staffUser.id}/deactivate`)
      .set('Origin', ALLOWED_ORIGIN)
      .set('Cookie', sessionCookieHeader(token));

    const res = await request(app)
      .get('/api/v1/users?isActive=false')
      .set('Cookie', sessionCookieHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.data.map((u: { id: string }) => u.id)).toContain(tenant.staffUser.id);
    expect(res.body.data.every((u: { isActive: boolean }) => u.isActive === false)).toBe(true);
  });

  it('searches by name/email via q', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();

    const localPart = tenant.adminUser.email.split('@')[0]!;
    const res = await request(app)
      .get(`/api/v1/users?q=${encodeURIComponent(localPart)}`)
      .set('Cookie', sessionCookieHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.data.some((u: { id: string }) => u.id === tenant.adminUser.id)).toBe(true);
  });

  it('caps pageSize at 100 and rejects anything larger with 422', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();

    const res = await request(app)
      .get('/api/v1/users?pageSize=101')
      .set('Cookie', sessionCookieHeader(token));
    expect(res.status).toBe(422);
  });
});
