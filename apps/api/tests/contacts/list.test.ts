import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';
import { createTestTenant } from '../helpers/tenant.js';
import { createSession } from '../../src/lib/session.js';
import { sessionCookieHeader } from '../helpers/http.js';

describe('GET /api/v1/contacts — list, pagination, sort, filters', () => {
  it('paginates correctly', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();

    for (let i = 0; i < 3; i++) {
      await prisma.contact.create({
        data: { organizationId: tenant.organization.id, firstName: `Contact${i}` },
      });
    }

    const res = await request(app)
      .get('/api/v1/contacts?page=1&pageSize=2')
      .set('Cookie', sessionCookieHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
    expect(res.body.meta).toEqual({ page: 1, pageSize: 2, total: 3 });
  });

  it('rejects an unknown sort field with 422', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();

    const res = await request(app)
      .get('/api/v1/contacts?sort=bogus:asc')
      .set('Cookie', sessionCookieHeader(token));
    expect(res.status).toBe(422);
  });

  it('filters by companyId', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();

    const company = await prisma.company.create({
      data: { organizationId: tenant.organization.id, name: 'Filter Co', nameNormalized: 'filter' },
    });
    const inCompany = await prisma.contact.create({
      data: { organizationId: tenant.organization.id, companyId: company.id, firstName: 'Inside' },
    });
    await prisma.contact.create({ data: { organizationId: tenant.organization.id, firstName: 'Outside' } });

    const res = await request(app)
      .get(`/api/v1/contacts?companyId=${company.id}`)
      .set('Cookie', sessionCookieHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.data.map((c: { id: string }) => c.id)).toEqual([inCompany.id]);
  });

  it('searches by first/last name via q', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();

    const created = await prisma.contact.create({
      data: { organizationId: tenant.organization.id, firstName: 'Findable', lastName: 'Person' },
    });

    const res = await request(app)
      .get('/api/v1/contacts?q=findable')
      .set('Cookie', sessionCookieHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.data.some((c: { id: string }) => c.id === created.id)).toBe(true);
  });

  it('requires a session (401)', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v1/contacts');
    expect(res.status).toBe(401);
  });
});
