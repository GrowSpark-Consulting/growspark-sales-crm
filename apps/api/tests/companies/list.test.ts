import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';
import { normalizeCompanyName } from '@growspark/shared';
import { createTestTenant } from '../helpers/tenant.js';
import { createSession } from '../../src/lib/session.js';
import { sessionCookieHeader } from '../helpers/http.js';

describe('GET /api/v1/companies — list, pagination, sort, filters', () => {
  it('paginates correctly', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();

    for (let i = 0; i < 3; i++) {
      await prisma.company.create({
        data: {
          organizationId: tenant.organization.id,
          name: `Company ${i}`,
          nameNormalized: normalizeCompanyName(`Company ${i}`)!,
        },
      });
    }

    const res = await request(app)
      .get('/api/v1/companies?page=1&pageSize=2')
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
      .get('/api/v1/companies?sort=bogus:asc')
      .set('Cookie', sessionCookieHeader(token));
    expect(res.status).toBe(422);
  });

  it('sorts by name ascending', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();

    await prisma.company.createMany({
      data: [
        { organizationId: tenant.organization.id, name: 'Zebra Co', nameNormalized: 'zebra' },
        { organizationId: tenant.organization.id, name: 'Alpha Co', nameNormalized: 'alpha' },
      ],
    });

    const res = await request(app)
      .get('/api/v1/companies?sort=name:asc')
      .set('Cookie', sessionCookieHeader(token));
    expect(res.status).toBe(200);
    const names = res.body.data.map((c: { name: string }) => c.name);
    expect(names).toEqual([...names].sort());
  });

  it('searches by name via q', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();

    const created = await prisma.company.create({
      data: {
        organizationId: tenant.organization.id,
        name: 'Findable Widgets Co',
        nameNormalized: normalizeCompanyName('Findable Widgets Co')!,
      },
    });

    const res = await request(app)
      .get('/api/v1/companies?q=findable')
      .set('Cookie', sessionCookieHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.data.some((c: { id: string }) => c.id === created.id)).toBe(true);
  });

  it('Staff can read the companies list (CONTACTS_READ/COMPANIES_READ are not Admin-only)', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.staffUser.id);
    const app = createApp();

    const res = await request(app).get('/api/v1/companies').set('Cookie', sessionCookieHeader(token));
    expect(res.status).toBe(200);
  });

  it('requires a session (401)', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v1/companies');
    expect(res.status).toBe(401);
  });

  it('requires the Origin header on a write (CSRF)', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();

    const res = await request(app)
      .post('/api/v1/companies')
      .set('Cookie', sessionCookieHeader(token))
      .send({ name: 'No Origin Co' });
    expect(res.status).toBe(403);
  });
});
