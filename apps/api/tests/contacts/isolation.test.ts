import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';
import { createTwoTestTenants } from '../helpers/tenant.js';
import { createSession } from '../../src/lib/session.js';
import { ALLOWED_ORIGIN, sessionCookieHeader } from '../helpers/http.js';

describe('contacts: organisation isolation', () => {
  it('a contact in another organisation returns 404, not the record', async () => {
    const [orgA, orgB] = await createTwoTestTenants();
    const contactB = await prisma.contact.create({
      data: { organizationId: orgB.organization.id, firstName: 'Org B Person' },
    });
    const { token } = await createSession(orgA.organization.id, orgA.adminUser.id);
    const app = createApp();

    const res = await request(app)
      .get(`/api/v1/contacts/${contactB.id}`)
      .set('Cookie', sessionCookieHeader(token));
    expect(res.status).toBe(404);
  });

  it("the contacts list for one organisation never includes another organisation's contacts", async () => {
    const [orgA, orgB] = await createTwoTestTenants();
    await prisma.contact.create({
      data: { organizationId: orgB.organization.id, firstName: 'Org B Person 2' },
    });
    const { token } = await createSession(orgA.organization.id, orgA.adminUser.id);
    const app = createApp();

    const res = await request(app).get('/api/v1/contacts').set('Cookie', sessionCookieHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.data.map((c: { firstName: string }) => c.firstName)).not.toContain('Org B Person 2');
  });

  it('cannot link a contact to a company that belongs to another organisation (404)', async () => {
    const [orgA, orgB] = await createTwoTestTenants();
    const companyB = await prisma.company.create({
      data: { organizationId: orgB.organization.id, name: 'Org B Co', nameNormalized: 'org b co' },
    });
    const { token } = await createSession(orgA.organization.id, orgA.adminUser.id);
    const app = createApp();

    const res = await request(app)
      .post('/api/v1/contacts')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Cookie', sessionCookieHeader(token))
      .send({ firstName: 'Cross Org', companyId: companyB.id });
    expect(res.status).toBe(404);
  });

  it('cannot update a contact in another organisation (404)', async () => {
    const [orgA, orgB] = await createTwoTestTenants();
    const contactB = await prisma.contact.create({
      data: { organizationId: orgB.organization.id, firstName: 'Org B Person 3' },
    });
    const { token } = await createSession(orgA.organization.id, orgA.adminUser.id);
    const app = createApp();

    const res = await request(app)
      .patch(`/api/v1/contacts/${contactB.id}`)
      .set('Origin', ALLOWED_ORIGIN)
      .set('Cookie', sessionCookieHeader(token))
      .send({ lastName: 'Hijacked' });
    expect(res.status).toBe(404);
  });

  it('duplicate detection never matches across organisations', async () => {
    const [orgA, orgB] = await createTwoTestTenants();
    await prisma.contact.create({
      data: {
        organizationId: orgB.organization.id,
        firstName: 'Org B Dup',
        email: 'shared@example.com',
        emailNormalized: 'shared@example.com',
      },
    });
    const { token } = await createSession(orgA.organization.id, orgA.adminUser.id);
    const app = createApp();

    const res = await request(app)
      .post('/api/v1/contacts')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Cookie', sessionCookieHeader(token))
      .send({ firstName: 'Org A Person', email: 'shared@example.com' });
    expect(res.status).toBe(201);
    expect(res.body.duplicates).toEqual([]);
  });
});
