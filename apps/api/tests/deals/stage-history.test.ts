import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';
import { createTestTenant, createTwoTestTenants, type TestTenant } from '../helpers/tenant.js';
import { createSession } from '../../src/lib/session.js';
import { ALLOWED_ORIGIN, sessionCookieHeader } from '../helpers/http.js';

function authed(app: ReturnType<typeof createApp>, token: string) {
  const cookie = sessionCookieHeader(token);
  return {
    get: (path: string) => request(app).get(path).set('Cookie', cookie),
    post: (path: string, body?: object) =>
      request(app).post(path).set('Origin', ALLOWED_ORIGIN).set('Cookie', cookie).send(body ?? {}),
  };
}

async function createCompany(tenant: TestTenant, name = 'Example Foods') {
  return prisma.company.create({
    data: { organizationId: tenant.organization.id, name, nameNormalized: name.toLowerCase() },
  });
}

describe('GET /api/v1/deals/:id/stage-history', () => {
  it('lists every stage move newest first, naming the actor (package 3.3, same shape as lead status history)', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();
    const api = authed(app, token);
    const company = await createCompany(tenant);
    const proposal = tenant.stages.find((s) => s.name === 'Proposal')!;

    const createRes = await api.post('/api/v1/deals', { name: 'History Deal', companyId: company.id });
    const dealId = createRes.body.data.id as string;
    await api.post(`/api/v1/deals/${dealId}/stage`, { stageId: proposal.id });

    const res = await api.get(`/api/v1/deals/${dealId}/stage-history`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    // Newest first: the move to Proposal, then the original creation row.
    expect(res.body.data[0].toStageId).toBe(proposal.id);
    expect(res.body.data[0].fromStageId).toBe(tenant.stages[0]!.id);
    expect(res.body.data[0].changedByName).toBe(tenant.adminUser.name);
    expect(res.body.data[1].fromStageId).toBeNull();
    expect(res.body.data[1].toStageId).toBe(tenant.stages[0]!.id);
  });

  it('Staff can read a deal\'s stage history (D29 equal standing)', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.staffUser.id);
    const app = createApp();
    const api = authed(app, token);
    const company = await createCompany(tenant);
    const createRes = await api.post('/api/v1/deals', { name: 'Staff Readable', companyId: company.id });

    const res = await api.get(`/api/v1/deals/${createRes.body.data.id}/stage-history`);
    expect(res.status).toBe(200);
  });

  it('a missing or cross-organisation deal id returns 404', async () => {
    const [orgA, orgB] = await createTwoTestTenants();
    const companyB = await createCompany(orgB, 'Org B Co');
    const { token: tokenB } = await createSession(orgB.organization.id, orgB.adminUser.id);
    const dealInOrgB = await authed(createApp(), tokenB).post('/api/v1/deals', { name: 'Org B Deal', companyId: companyB.id });

    const { token } = await createSession(orgA.organization.id, orgA.adminUser.id);
    const app = createApp();
    const api = authed(app, token);

    const res = await api.get(`/api/v1/deals/${dealInOrgB.body.data.id}/stage-history`);
    expect(res.status).toBe(404);

    const missingRes = await api.get('/api/v1/deals/00000000-0000-7000-8000-000000000000/stage-history');
    expect(missingRes.status).toBe(404);
  });
});
