import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { normalizeCompanyName } from '@growspark/shared';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';
import { createTwoTestTenants } from '../helpers/tenant.js';
import { createSession } from '../../src/lib/session.js';
import { ALLOWED_ORIGIN, sessionCookieHeader } from '../helpers/http.js';

describe('companies: organisation isolation', () => {
  it('a company in another organisation returns 404, not the record', async () => {
    const [orgA, orgB] = await createTwoTestTenants();
    const companyB = await prisma.company.create({
      data: {
        organizationId: orgB.organization.id,
        name: 'Org B Co',
        nameNormalized: normalizeCompanyName('Org B Co')!,
      },
    });
    const { token } = await createSession(orgA.organization.id, orgA.adminUser.id);
    const app = createApp();

    const res = await request(app)
      .get(`/api/v1/companies/${companyB.id}`)
      .set('Cookie', sessionCookieHeader(token));
    expect(res.status).toBe(404);
  });

  it("the companies list for one organisation never includes another organisation's companies", async () => {
    const [orgA, orgB] = await createTwoTestTenants();
    await prisma.company.create({
      data: {
        organizationId: orgB.organization.id,
        name: 'Org B Co 2',
        nameNormalized: normalizeCompanyName('Org B Co 2')!,
      },
    });
    const { token } = await createSession(orgA.organization.id, orgA.adminUser.id);
    const app = createApp();

    const res = await request(app).get('/api/v1/companies').set('Cookie', sessionCookieHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.data.map((c: { name: string }) => c.name)).not.toContain('Org B Co 2');
  });

  it('cannot update a company in another organisation (404)', async () => {
    const [orgA, orgB] = await createTwoTestTenants();
    const companyB = await prisma.company.create({
      data: {
        organizationId: orgB.organization.id,
        name: 'Org B Co 3',
        nameNormalized: normalizeCompanyName('Org B Co 3')!,
      },
    });
    const { token } = await createSession(orgA.organization.id, orgA.adminUser.id);
    const app = createApp();

    const res = await request(app)
      .patch(`/api/v1/companies/${companyB.id}`)
      .set('Origin', ALLOWED_ORIGIN)
      .set('Cookie', sessionCookieHeader(token))
      .send({ industry: 'Hijacked' });
    expect(res.status).toBe(404);
  });

  it('cannot archive a company in another organisation (404)', async () => {
    const [orgA, orgB] = await createTwoTestTenants();
    const companyB = await prisma.company.create({
      data: {
        organizationId: orgB.organization.id,
        name: 'Org B Co 4',
        nameNormalized: normalizeCompanyName('Org B Co 4')!,
      },
    });
    const { token } = await createSession(orgA.organization.id, orgA.adminUser.id);
    const app = createApp();

    const res = await request(app)
      .post(`/api/v1/companies/${companyB.id}/archive`)
      .set('Origin', ALLOWED_ORIGIN)
      .set('Cookie', sessionCookieHeader(token));
    expect(res.status).toBe(404);
  });

  it('duplicate detection never matches across organisations', async () => {
    const [orgA, orgB] = await createTwoTestTenants();
    await prisma.company.create({
      data: {
        organizationId: orgB.organization.id,
        name: 'Shared Name Co',
        nameNormalized: normalizeCompanyName('Shared Name Co')!,
      },
    });
    const { token } = await createSession(orgA.organization.id, orgA.adminUser.id);
    const app = createApp();

    const res = await request(app)
      .post('/api/v1/companies')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Cookie', sessionCookieHeader(token))
      .send({ name: 'Shared Name Co' });
    expect(res.status).toBe(201);
    expect(res.body.duplicates).toEqual([]);
  });
});
