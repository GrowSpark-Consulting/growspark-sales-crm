import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';
import { createTestTenant, type TestTenant } from '../helpers/tenant.js';
import { createSession } from '../../src/lib/session.js';
import { ALLOWED_ORIGIN, sessionCookieHeader } from '../helpers/http.js';

function authed(app: ReturnType<typeof createApp>, token: string) {
  const cookie = sessionCookieHeader(token);
  return {
    get: (path: string) => request(app).get(path).set('Cookie', cookie),
    post: (path: string, body?: object) =>
      request(app).post(path).set('Origin', ALLOWED_ORIGIN).set('Cookie', cookie).send(body ?? {}),
    patch: (path: string, body?: object) =>
      request(app).patch(path).set('Origin', ALLOWED_ORIGIN).set('Cookie', cookie).send(body ?? {}),
  };
}

async function createCompany(tenant: TestTenant, name = 'Example Foods') {
  return prisma.company.create({
    data: { organizationId: tenant.organization.id, name, nameNormalized: name.toLowerCase() },
  });
}

async function setUpOpenDeal(api: ReturnType<typeof authed>, tenant: TestTenant) {
  const company = await createCompany(tenant);
  const res = await api.post('/api/v1/deals', { name: 'Stage Test Deal', companyId: company.id, value: 100000 });
  return res.body.data.id as string;
}

describe('Deal stage moves and closing', () => {
  it('moving to a later open stage writes a DealStageHistory row and copies its probability', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();
    const api = authed(app, token);
    const dealId = await setUpOpenDeal(api, tenant);
    const proposalStage = tenant.stages.find((s) => s.name === 'Proposal')!;

    const res = await api.post(`/api/v1/deals/${dealId}/stage`, { stageId: proposalStage.id });
    expect(res.status).toBe(200);
    expect(res.body.data.stageId).toBe(proposalStage.id);
    expect(res.body.data.probability).toBe(proposalStage.probability);

    const history = await prisma.dealStageHistory.findMany({ where: { dealId }, orderBy: { createdAt: 'asc' } });
    expect(history).toHaveLength(2); // the create-time row, then this move
    expect(history[1]!.fromStageId).toBe(tenant.stages[0]!.id);
    expect(history[1]!.toStageId).toBe(proposalStage.id);
  });

  it('a stage move overwrites a manually-edited probability with the new stage\'s own (D7: copied on every stage change)', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();
    const api = authed(app, token);
    const dealId = await setUpOpenDeal(api, tenant);
    await api.patch(`/api/v1/deals/${dealId}`, { probability: 99 });

    const negotiationStage = tenant.stages.find((s) => s.name === 'Negotiation')!;
    const res = await api.post(`/api/v1/deals/${dealId}/stage`, { stageId: negotiationStage.id });
    expect(res.status).toBe(200);
    expect(res.body.data.probability).toBe(negotiationStage.probability);
  });

  it('rejects moving to a Won/Lost-type stage via the stage endpoint (422) — close must be used instead', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();
    const api = authed(app, token);
    const dealId = await setUpOpenDeal(api, tenant);
    const wonStage = tenant.stages.find((s) => s.type === 'WON')!;

    const res = await api.post(`/api/v1/deals/${dealId}/stage`, { stageId: wonStage.id });
    expect(res.status).toBe(422);

    const deal = await prisma.deal.findUniqueOrThrow({ where: { id: dealId } });
    expect(deal.stageId).not.toBe(wonStage.id); // unchanged
  });

  it('rejects closing Lost without a reason (422)', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();
    const api = authed(app, token);
    const dealId = await setUpOpenDeal(api, tenant);

    const res = await api.post(`/api/v1/deals/${dealId}/close`, { status: 'LOST' });
    expect(res.status).toBe(422);
  });

  it('closing Won sets probability 100, closedAt, moves to the Won stage, and writes history', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();
    const api = authed(app, token);
    const dealId = await setUpOpenDeal(api, tenant);
    const wonStage = tenant.stages.find((s) => s.type === 'WON')!;

    const res = await api.post(`/api/v1/deals/${dealId}/close`, { status: 'WON' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('WON');
    expect(res.body.data.probability).toBe(100);
    expect(res.body.data.stageId).toBe(wonStage.id);
    expect(res.body.data.closedAt).not.toBeNull();

    const history = await prisma.dealStageHistory.findMany({ where: { dealId }, orderBy: { createdAt: 'asc' } });
    expect(history).toHaveLength(2);
    expect(history[1]!.toStageId).toBe(wonStage.id);
  });

  it('closing Lost with a reason sets probability 0 and the lost stage', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();
    const api = authed(app, token);
    const dealId = await setUpOpenDeal(api, tenant);
    const lostStage = tenant.stages.find((s) => s.type === 'LOST')!;

    const res = await api.post(`/api/v1/deals/${dealId}/close`, { status: 'LOST', lostReason: 'Price', lostNote: 'Too expensive' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('LOST');
    expect(res.body.data.probability).toBe(0);
    expect(res.body.data.stageId).toBe(lostStage.id);
    expect(res.body.data.lostReason).toBe('Price');
    expect(res.body.data.lostNote).toBe('Too expensive');
  });

  it('a closed deal is read-only (PATCH, /stage, and /contacts all refused with 409) except reopen', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();
    const api = authed(app, token);
    const dealId = await setUpOpenDeal(api, tenant);
    await api.post(`/api/v1/deals/${dealId}/close`, { status: 'WON' });

    expect((await api.patch(`/api/v1/deals/${dealId}`, { value: 1 })).status).toBe(409);
    const proposalStage = tenant.stages.find((s) => s.name === 'Proposal')!;
    expect((await api.post(`/api/v1/deals/${dealId}/stage`, { stageId: proposalStage.id })).status).toBe(409);
    expect((await api.post(`/api/v1/deals/${dealId}/close`, { status: 'WON' })).status).toBe(409);

    const reopenRes = await api.post(`/api/v1/deals/${dealId}/reopen`);
    expect(reopenRes.status).toBe(200);
    expect(reopenRes.body.data.status).toBe('OPEN');
    expect(reopenRes.body.data.stageId).toBe(tenant.stages[0]!.id);
    expect(reopenRes.body.data.closedAt).toBeNull();
    expect(reopenRes.body.data.lostReason).toBeNull();

    // Reopened — writes are allowed again.
    expect((await api.patch(`/api/v1/deals/${dealId}`, { value: 5 })).status).toBe(200);
  });

  it('reopening an already-open deal is refused (409)', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();
    const api = authed(app, token);
    const dealId = await setUpOpenDeal(api, tenant);

    const res = await api.post(`/api/v1/deals/${dealId}/reopen`);
    expect(res.status).toBe(409);
  });
});
