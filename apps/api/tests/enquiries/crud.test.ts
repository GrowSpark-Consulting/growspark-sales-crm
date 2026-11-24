import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { createTestTenant, createTwoTestTenants } from '../helpers/tenant.js';
import { createTestApiKey } from '../helpers/api-key.js';
import { ensureWebsiteLeadSource, intakeRequest } from '../helpers/intake.js';
import { createSession } from '../../src/lib/session.js';
import { prisma } from '../../src/db/prisma.js';
import { ALLOWED_ORIGIN, sessionCookieHeader } from '../helpers/http.js';
import type { TestTenant } from '../helpers/tenant.js';

function authed(app: ReturnType<typeof createApp>, token: string) {
  const cookie = sessionCookieHeader(token);
  return {
    get: (path: string) => request(app).get(path).set('Cookie', cookie),
    post: (path: string) => request(app).post(path).set('Origin', ALLOWED_ORIGIN).set('Cookie', cookie).send({}),
  };
}

/** Seeds one successful (LEAD_CREATED) submission via the real intake route, as every other enquiry originates. */
async function seedEnquiry(app: ReturnType<typeof createApp>, tenant: TestTenant, externalId: string) {
  await ensureWebsiteLeadSource(tenant);
  const { key } = await createTestApiKey(tenant);
  const res = await intakeRequest(app, key, externalId, {
    formType: 'contact',
    sourcePage: 'https://www.growsparkconsulting.com/contact/',
    fields: { name: 'Asha Rao', email: `${externalId}@example.com`, challenge: 'Needs automation.' },
  });
  expect(res.status).toBe(201);
  return { submissionId: res.body.data.submissionId as string, leadId: res.body.data.leadId as string };
}

describe('Enquiries: list, detail, mark-spam, archive, restore', () => {
  it('lists an enquiry created via intake, and its detail view carries the raw payload and a linked-lead summary', async () => {
    const tenant = await createTestTenant();
    const app = createApp();
    const { submissionId, leadId } = await seedEnquiry(app, tenant, 'enq-1');
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const api = authed(app, token);

    const listRes = await api.get('/api/v1/enquiries');
    expect(listRes.status).toBe(200);
    const row = listRes.body.data.find((e: { id: string }) => e.id === submissionId);
    expect(row).toBeDefined();
    expect(row.status).toBe('LEAD_CREATED');
    expect(row.leadId).toBe(leadId);
    expect(row.payload).toBeUndefined();

    const detailRes = await api.get(`/api/v1/enquiries/${submissionId}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.data.payload).toMatchObject({ formType: 'contact' });
    expect(detailRes.body.data.lead).toMatchObject({ id: leadId, firstName: 'Asha', lastName: 'Rao' });
  });

  it('filters by status, formType, and received date range', async () => {
    const tenant = await createTestTenant();
    const app = createApp();
    const { submissionId } = await seedEnquiry(app, tenant, 'enq-filter-1');
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const api = authed(app, token);

    const byStatus = await api.get('/api/v1/enquiries?status=LEAD_CREATED');
    expect(byStatus.body.data.some((e: { id: string }) => e.id === submissionId)).toBe(true);

    const wrongStatus = await api.get('/api/v1/enquiries?status=SPAM');
    expect(wrongStatus.body.data.some((e: { id: string }) => e.id === submissionId)).toBe(false);

    const byFormType = await api.get('/api/v1/enquiries?formType=contact');
    expect(byFormType.body.data.some((e: { id: string }) => e.id === submissionId)).toBe(true);

    const wrongFormType = await api.get('/api/v1/enquiries?formType=strategy_session');
    expect(wrongFormType.body.data.some((e: { id: string }) => e.id === submissionId)).toBe(false);

    const farFuture = await api.get('/api/v1/enquiries?receivedFrom=2099-01-01T00:00:00.000Z');
    expect(farFuture.body.data.some((e: { id: string }) => e.id === submissionId)).toBe(false);
  });

  it('mark-spam sets status SPAM and archives the linked Lead in the same transaction; a second call is 409 ALREADY_SPAM', async () => {
    const tenant = await createTestTenant();
    const app = createApp();
    const { submissionId, leadId } = await seedEnquiry(app, tenant, 'enq-spam-1');
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const api = authed(app, token);

    const markRes = await api.post(`/api/v1/enquiries/${submissionId}/mark-spam`);
    expect(markRes.status).toBe(200);
    expect(markRes.body.data.status).toBe('SPAM');

    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
    expect(lead.archivedAt).not.toBeNull();

    const secondRes = await api.post(`/api/v1/enquiries/${submissionId}/mark-spam`);
    expect(secondRes.status).toBe(409);
    expect(secondRes.body.error.code).toBe('ALREADY_SPAM');
  });

  it('archive and restore follow the same convention as every other archivable resource', async () => {
    const tenant = await createTestTenant();
    const app = createApp();
    const { submissionId } = await seedEnquiry(app, tenant, 'enq-archive-1');
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const api = authed(app, token);

    const restoreNotArchived = await api.post(`/api/v1/enquiries/${submissionId}/restore`);
    expect(restoreNotArchived.status).toBe(409);
    expect(restoreNotArchived.body.error.code).toBe('NOT_ARCHIVED');

    const archiveRes = await api.post(`/api/v1/enquiries/${submissionId}/archive`);
    expect(archiveRes.status).toBe(200);
    expect(archiveRes.body.data.archivedAt).not.toBeNull();

    const hiddenRes = await api.get('/api/v1/enquiries');
    expect(hiddenRes.body.data.some((e: { id: string }) => e.id === submissionId)).toBe(false);

    const archivedOnlyRes = await api.get('/api/v1/enquiries?archived=true');
    expect(archivedOnlyRes.body.data.some((e: { id: string }) => e.id === submissionId)).toBe(true);

    const archiveAgain = await api.post(`/api/v1/enquiries/${submissionId}/archive`);
    expect(archiveAgain.status).toBe(409);
    expect(archiveAgain.body.error.code).toBe('ALREADY_ARCHIVED');

    const restoreRes = await api.post(`/api/v1/enquiries/${submissionId}/restore`);
    expect(restoreRes.status).toBe(200);
    expect(restoreRes.body.data.archivedAt).toBeNull();
  });

  it('Staff has the same access as Admin (list, detail, mark-spam, archive, restore) — same visibility as Leads', async () => {
    const tenant = await createTestTenant();
    const app = createApp();
    const { submissionId } = await seedEnquiry(app, tenant, 'enq-staff-1');
    const { token } = await createSession(tenant.organization.id, tenant.staffUser.id);
    const api = authed(app, token);

    expect((await api.get('/api/v1/enquiries')).status).toBe(200);
    expect((await api.get(`/api/v1/enquiries/${submissionId}`)).status).toBe(200);
    expect((await api.post(`/api/v1/enquiries/${submissionId}/archive`)).status).toBe(200);
    expect((await api.post(`/api/v1/enquiries/${submissionId}/restore`)).status).toBe(200);
    expect((await api.post(`/api/v1/enquiries/${submissionId}/mark-spam`)).status).toBe(200);
  });

  it('GET /api/v1/enquiries/:id returns 404 for an id that does not exist', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const api = authed(createApp(), token);

    const res = await api.get('/api/v1/enquiries/00000000-0000-7000-8000-000000000000');
    expect(res.status).toBe(404);
  });

  it("one organisation's enquiries never appear in, or can be acted on by, another's session", async () => {
    const [orgA, orgB] = await createTwoTestTenants();
    const app = createApp();
    const { submissionId } = await seedEnquiry(app, orgA, 'enq-isolation-1');

    const { token: tokenB } = await createSession(orgB.organization.id, orgB.adminUser.id);
    const apiB = authed(app, tokenB);

    const listRes = await apiB.get('/api/v1/enquiries');
    expect(listRes.body.data.some((e: { id: string }) => e.id === submissionId)).toBe(false);

    const detailRes = await apiB.get(`/api/v1/enquiries/${submissionId}`);
    expect(detailRes.status).toBe(404);

    const archiveRes = await apiB.post(`/api/v1/enquiries/${submissionId}/archive`);
    expect(archiveRes.status).toBe(404);
  });
});
