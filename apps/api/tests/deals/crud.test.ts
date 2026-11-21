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
    patch: (path: string, body?: object) =>
      request(app).patch(path).set('Origin', ALLOWED_ORIGIN).set('Cookie', cookie).send(body ?? {}),
    put: (path: string, body?: object) =>
      request(app).put(path).set('Origin', ALLOWED_ORIGIN).set('Cookie', cookie).send(body ?? {}),
  };
}

async function createCompany(tenant: TestTenant, name = 'Example Foods') {
  return prisma.company.create({
    data: { organizationId: tenant.organization.id, name, nameNormalized: name.toLowerCase() },
  });
}

describe('Deals CRUD', () => {
  it('creates a deal in the first open stage, with probability copied from the stage and owner defaulted to the caller', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();
    const api = authed(app, token);
    const company = await createCompany(tenant);

    const res = await api.post('/api/v1/deals', { name: 'Example Deal', companyId: company.id, value: '056677.25' });
    expect(res.status).toBe(201);
    expect(res.body.data.stageId).toBe(tenant.stages[0]!.id);
    expect(res.body.data.probability).toBe(tenant.stages[0]!.probability);
    expect(res.body.data.ownerId).toBe(tenant.adminUser.id);
    expect(res.body.data.currency).toBe('INR');
    expect(res.body.data.status).toBe('OPEN');
    expect(res.body.data.value).toBe('56677.25');

    const history = await prisma.dealStageHistory.findMany({ where: { dealId: res.body.data.id } });
    expect(history).toHaveLength(1);
    expect(history[0]!.fromStageId).toBeNull();
    expect(history[0]!.toStageId).toBe(tenant.stages[0]!.id);
  });

  it('rejects a deal with no companyId (422)', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();
    const api = authed(app, token);

    const res = await api.post('/api/v1/deals', { name: 'No Company' });
    expect(res.status).toBe(422);
  });

  it('reads, lists, updates, archives, and restores a deal', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();
    const api = authed(app, token);
    const company = await createCompany(tenant);

    const createRes = await api.post('/api/v1/deals', { name: 'Full Lifecycle', companyId: company.id });
    const dealId = createRes.body.data.id as string;

    const getRes = await api.get(`/api/v1/deals/${dealId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.name).toBe('Full Lifecycle');

    const listRes = await api.get('/api/v1/deals');
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.some((d: { id: string }) => d.id === dealId)).toBe(true);

    const patchRes = await api.patch(`/api/v1/deals/${dealId}`, { value: 999999, probability: 42 });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.value).toBe('999999');
    expect(patchRes.body.data.probability).toBe(42);

    const archiveRes = await api.post(`/api/v1/deals/${dealId}/archive`);
    expect(archiveRes.status).toBe(200);
    expect(archiveRes.body.data.archivedAt).not.toBeNull();

    const hiddenRes = await api.get('/api/v1/deals');
    expect(hiddenRes.body.data.some((d: { id: string }) => d.id === dealId)).toBe(false);

    const archivedOnlyRes = await api.get('/api/v1/deals?archived=true');
    expect(archivedOnlyRes.body.data.some((d: { id: string }) => d.id === dealId)).toBe(true);

    const restoreRes = await api.post(`/api/v1/deals/${dealId}/restore`);
    expect(restoreRes.status).toBe(200);
    expect(restoreRes.body.data.archivedAt).toBeNull();
  });

  it('archiving an already-archived deal returns 409 ALREADY_ARCHIVED; restoring a non-archived one returns 409 NOT_ARCHIVED', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();
    const api = authed(app, token);
    const company = await createCompany(tenant);
    const createRes = await api.post('/api/v1/deals', { name: 'Double Archive', companyId: company.id });
    const dealId = createRes.body.data.id as string;

    const notArchivedRes = await api.post(`/api/v1/deals/${dealId}/restore`);
    expect(notArchivedRes.status).toBe(409);
    expect(notArchivedRes.body.error.code).toBe('NOT_ARCHIVED');

    await api.post(`/api/v1/deals/${dealId}/archive`);
    const alreadyArchivedRes = await api.post(`/api/v1/deals/${dealId}/archive`);
    expect(alreadyArchivedRes.status).toBe(409);
    expect(alreadyArchivedRes.body.error.code).toBe('ALREADY_ARCHIVED');
  });

  it('PUT /deals/:id/contacts replaces the contact set and marks a primary', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();
    const api = authed(app, token);
    const company = await createCompany(tenant);
    const contactA = await prisma.contact.create({ data: { organizationId: tenant.organization.id, firstName: 'A' } });
    const contactB = await prisma.contact.create({
      data: { organizationId: tenant.organization.id, firstName: 'B', lastName: 'Two' },
    });
    const createRes = await api.post('/api/v1/deals', { name: 'Contacts Deal', companyId: company.id });
    const dealId = createRes.body.data.id as string;
    // A freshly created deal has no contacts yet — the GET response's
    // summary array is genuinely empty, not merely absent (package 3.3).
    expect(createRes.body.data.contacts).toEqual([]);

    const putRes = await api.put(`/api/v1/deals/${dealId}/contacts`, {
      contactIds: [contactA.id, contactB.id],
      primaryContactId: contactB.id,
    });
    expect(putRes.status).toBe(200);
    expect(putRes.body.data).toHaveLength(2);
    const primary = putRes.body.data.find((c: { contactId: string }) => c.contactId === contactB.id);
    expect(primary.isPrimary).toBe(true);

    // GET /deals/:id's own `contacts` summary (package 3.3) reflects the
    // same state, including the joined contact name, without a second
    // round trip per contact.
    const getRes = await api.get(`/api/v1/deals/${dealId}`);
    expect(getRes.body.data.contacts).toHaveLength(2);
    const summaryB = getRes.body.data.contacts.find((c: { contactId: string }) => c.contactId === contactB.id);
    expect(summaryB.contactName).toBe('B Two');
    expect(summaryB.isPrimary).toBe(true);
    const summaryA = getRes.body.data.contacts.find((c: { contactId: string }) => c.contactId === contactA.id);
    expect(summaryA.isPrimary).toBe(false);

    // Replacing again drops the old set entirely.
    const secondPutRes = await api.put(`/api/v1/deals/${dealId}/contacts`, { contactIds: [contactA.id] });
    expect(secondPutRes.status).toBe(200);
    expect(secondPutRes.body.data).toHaveLength(1);
    expect(secondPutRes.body.data[0].contactId).toBe(contactA.id);

    const getAfterSecondPut = await api.get(`/api/v1/deals/${dealId}`);
    expect(getAfterSecondPut.body.data.contacts).toHaveLength(1);
    expect(getAfterSecondPut.body.data.contacts[0].contactId).toBe(contactA.id);
  });

  it('GET /deals?contactId= filters to deals that contact is linked to', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();
    const api = authed(app, token);
    const company = await createCompany(tenant);
    const contact = await prisma.contact.create({ data: { organizationId: tenant.organization.id, firstName: 'Linked' } });
    const linkedDeal = await api.post('/api/v1/deals', { name: 'Linked Deal', companyId: company.id });
    const unlinkedDeal = await api.post('/api/v1/deals', { name: 'Unlinked Deal', companyId: company.id });
    await api.put(`/api/v1/deals/${linkedDeal.body.data.id}/contacts`, { contactIds: [contact.id] });

    const res = await api.get(`/api/v1/deals?contactId=${contact.id}`);
    expect(res.status).toBe(200);
    const ids = res.body.data.map((d: { id: string }) => d.id);
    expect(ids).toContain(linkedDeal.body.data.id);
    expect(ids).not.toContain(unlinkedDeal.body.data.id);
  });

  it('Staff can create, edit, and archive deals (D29 equal standing)', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.staffUser.id);
    const app = createApp();
    const api = authed(app, token);
    const company = await createCompany(tenant);

    const createRes = await api.post('/api/v1/deals', { name: 'Staff Deal', companyId: company.id });
    expect(createRes.status).toBe(201);
    const dealId = createRes.body.data.id as string;

    expect((await api.patch(`/api/v1/deals/${dealId}`, { value: 1000 })).status).toBe(200);
    expect((await api.post(`/api/v1/deals/${dealId}/archive`)).status).toBe(200);
  });

  it('a deal in another organisation returns 404, not the record', async () => {
    const [orgA, orgB] = await createTwoTestTenants();
    const companyB = await createCompany(orgB, 'Org B Co');
    const { token: tokenB } = await createSession(orgB.organization.id, orgB.adminUser.id);
    const appForB = createApp();
    const dealInOrgB = await authed(appForB, tokenB).post('/api/v1/deals', { name: 'Org B Deal', companyId: companyB.id });

    const { token } = await createSession(orgA.organization.id, orgA.adminUser.id);
    const app = createApp();
    const api = authed(app, token);

    const res = await api.get(`/api/v1/deals/${dealInOrgB.body.data.id}`);
    expect(res.status).toBe(404);
  });

  it('a companyId from another organisation is rejected on create (404)', async () => {
    const [orgA, orgB] = await createTwoTestTenants();
    const companyB = await createCompany(orgB, 'Org B Co');
    const { token } = await createSession(orgA.organization.id, orgA.adminUser.id);
    const app = createApp();
    const api = authed(app, token);

    const res = await api.post('/api/v1/deals', { name: 'Cross Org', companyId: companyB.id });
    expect(res.status).toBe(404);
  });
});
