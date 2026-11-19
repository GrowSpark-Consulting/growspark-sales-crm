import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';
import { createTwoTestTenants } from '../helpers/tenant.js';
import { createSession } from '../../src/lib/session.js';
import { ALLOWED_ORIGIN, sessionCookieHeader } from '../helpers/http.js';

describe('leads: organisation isolation', () => {
  it('a lead in another organisation returns 404, not the record', async () => {
    const [orgA, orgB] = await createTwoTestTenants();
    const leadB = await prisma.lead.create({
      data: {
        organizationId: orgB.organization.id,
        firstName: 'Org B Lead',
        sourceId: orgB.leadSource.id,
        email: 'org-b@example.com',
        emailNormalized: 'org-b@example.com',
      },
    });
    const { token } = await createSession(orgA.organization.id, orgA.adminUser.id);
    const app = createApp();

    const res = await request(app).get(`/api/v1/leads/${leadB.id}`).set('Cookie', sessionCookieHeader(token));
    expect(res.status).toBe(404);
  });

  it("the leads list for one organisation never includes another organisation's leads", async () => {
    const [orgA, orgB] = await createTwoTestTenants();
    await prisma.lead.create({
      data: {
        organizationId: orgB.organization.id,
        firstName: 'Org B Lead 2',
        sourceId: orgB.leadSource.id,
        email: 'org-b-2@example.com',
        emailNormalized: 'org-b-2@example.com',
      },
    });
    const { token } = await createSession(orgA.organization.id, orgA.adminUser.id);
    const app = createApp();

    const res = await request(app).get('/api/v1/leads').set('Cookie', sessionCookieHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.data.map((l: { firstName: string }) => l.firstName)).not.toContain('Org B Lead 2');
  });

  it('cannot use a lead source from another organisation (404)', async () => {
    const [orgA, orgB] = await createTwoTestTenants();
    const { token } = await createSession(orgA.organization.id, orgA.adminUser.id);
    const app = createApp();

    const res = await request(app)
      .post('/api/v1/leads')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Cookie', sessionCookieHeader(token))
      .send({ firstName: 'Cross Org', email: 'cross-org@example.com', sourceId: orgB.leadSource.id });
    expect(res.status).toBe(404);
  });

  it('cannot update or change the status of a lead in another organisation (404)', async () => {
    const [orgA, orgB] = await createTwoTestTenants();
    const leadB = await prisma.lead.create({
      data: {
        organizationId: orgB.organization.id,
        firstName: 'Org B Lead 3',
        sourceId: orgB.leadSource.id,
        email: 'org-b-3@example.com',
        emailNormalized: 'org-b-3@example.com',
      },
    });
    const { token } = await createSession(orgA.organization.id, orgA.adminUser.id);
    const app = createApp();

    const patchRes = await request(app)
      .patch(`/api/v1/leads/${leadB.id}`)
      .set('Origin', ALLOWED_ORIGIN)
      .set('Cookie', sessionCookieHeader(token))
      .send({ jobTitle: 'Hijacked' });
    expect(patchRes.status).toBe(404);

    const statusRes = await request(app)
      .post(`/api/v1/leads/${leadB.id}/status`)
      .set('Origin', ALLOWED_ORIGIN)
      .set('Cookie', sessionCookieHeader(token))
      .send({ status: 'QUALIFIED' });
    expect(statusRes.status).toBe(404);
  });

  it('duplicate detection never matches across organisations', async () => {
    const [orgA, orgB] = await createTwoTestTenants();
    await prisma.lead.create({
      data: {
        organizationId: orgB.organization.id,
        firstName: 'Org B Dup',
        sourceId: orgB.leadSource.id,
        email: 'shared@example.com',
        emailNormalized: 'shared@example.com',
      },
    });
    const { token } = await createSession(orgA.organization.id, orgA.adminUser.id);
    const app = createApp();

    const res = await request(app)
      .post('/api/v1/leads')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Cookie', sessionCookieHeader(token))
      .send({ firstName: 'Org A Lead', email: 'shared@example.com', sourceId: orgA.leadSource.id });
    expect(res.status).toBe(201);
    expect(res.body.duplicates).toEqual([]);
  });
});
