import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { createTestTenant } from '../helpers/tenant.js';
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

describe('Companies CRUD', () => {
  it('creates, reads, lists, updates, archives, and restores a company', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();
    const api = authed(app, token);

    const createRes = await api.post('/api/v1/companies', {
      name: 'Example Foods Pvt Ltd',
      industry: 'Manufacturing',
      annualRevenue: 5000000,
    });
    expect(createRes.status).toBe(201);
    expect(createRes.body.data.name).toBe('Example Foods Pvt Ltd');
    expect(Number(createRes.body.data.annualRevenue)).toBe(5000000);
    expect(createRes.body.duplicates).toEqual([]);
    const companyId = createRes.body.data.id as string;

    const getRes = await api.get(`/api/v1/companies/${companyId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.industry).toBe('Manufacturing');

    const listRes = await api.get('/api/v1/companies');
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.some((c: { id: string }) => c.id === companyId)).toBe(true);

    const patchRes = await api.patch(`/api/v1/companies/${companyId}`, { industry: 'Food Processing' });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.industry).toBe('Food Processing');

    const archiveRes = await api.post(`/api/v1/companies/${companyId}/archive`);
    expect(archiveRes.status).toBe(200);
    expect(archiveRes.body.data.archivedAt).not.toBeNull();

    const hiddenRes = await api.get('/api/v1/companies');
    expect(hiddenRes.body.data.some((c: { id: string }) => c.id === companyId)).toBe(false);

    const archivedOnlyRes = await api.get('/api/v1/companies?archived=true');
    expect(archivedOnlyRes.body.data.some((c: { id: string }) => c.id === companyId)).toBe(true);

    const restoreRes = await api.post(`/api/v1/companies/${companyId}/restore`);
    expect(restoreRes.status).toBe(200);
    expect(restoreRes.body.data.archivedAt).toBeNull();

    const visibleAgainRes = await api.get('/api/v1/companies');
    expect(visibleAgainRes.body.data.some((c: { id: string }) => c.id === companyId)).toBe(true);
  });

  it('clearing an optional field with an empty string sets it to null', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();
    const api = authed(app, token);

    const createRes = await api.post('/api/v1/companies', { name: 'Has Industry Co', industry: 'Retail' });
    const companyId = createRes.body.data.id as string;

    const patchRes = await api.patch(`/api/v1/companies/${companyId}`, { industry: '' });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.industry).toBeNull();
  });

  it('Staff can create, edit, archive, and restore companies (D29)', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.staffUser.id);
    const app = createApp();
    const api = authed(app, token);

    const createRes = await api.post('/api/v1/companies', { name: 'Staff Created Co' });
    expect(createRes.status).toBe(201);
    const companyId = createRes.body.data.id as string;

    expect((await api.patch(`/api/v1/companies/${companyId}`, { industry: 'Logistics' })).status).toBe(200);
    expect((await api.post(`/api/v1/companies/${companyId}/archive`)).status).toBe(200);
    expect((await api.post(`/api/v1/companies/${companyId}/restore`)).status).toBe(200);
  });

  it('warns about a duplicate company name but still saves (D29)', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();
    const api = authed(app, token);

    await api.post('/api/v1/companies', { name: 'Acme Corp Inc' });
    const secondRes = await api.post('/api/v1/companies', { name: 'ACME' });

    expect(secondRes.status).toBe(201);
    expect(secondRes.body.duplicates.length).toBe(1);
    expect(secondRes.body.duplicates[0].reason).toBe('companyName');
  });

  it('rejects a create body with a blank name (422)', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();
    const api = authed(app, token);

    const res = await api.post('/api/v1/companies', { name: '   ' });
    expect(res.status).toBe(422);
  });

  it('GET /api/v1/companies/:id returns 404 for an id that does not exist', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();
    const api = authed(app, token);

    const res = await api.get('/api/v1/companies/00000000-0000-7000-8000-000000000000');
    expect(res.status).toBe(404);
  });

  it('rejects a create body with an ownerId that does not belong to the organisation (404)', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();
    const api = authed(app, token);

    const res = await api.post('/api/v1/companies', {
      name: 'Bad Owner Co',
      ownerId: '00000000-0000-7000-8000-000000000000',
    });
    expect(res.status).toBe(404);
  });

  it('archiving an already-archived company returns 404', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();
    const api = authed(app, token);

    const createRes = await api.post('/api/v1/companies', { name: 'Double Archive Co' });
    const companyId = createRes.body.data.id as string;
    await api.post(`/api/v1/companies/${companyId}/archive`);

    const res = await api.post(`/api/v1/companies/${companyId}/archive`);
    expect(res.status).toBe(404);
  });
});
