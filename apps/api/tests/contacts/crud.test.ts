import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { normalizeCompanyName } from '@growspark/shared';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';
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

describe('Contacts CRUD', () => {
  it('creates, reads, lists, updates, archives, and restores a contact, linked to a company', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();
    const api = authed(app, token);

    const company = await prisma.company.create({
      data: {
        organizationId: tenant.organization.id,
        name: 'Parent Co',
        nameNormalized: normalizeCompanyName('Parent Co')!,
      },
    });

    const createRes = await api.post('/api/v1/contacts', {
      companyId: company.id,
      firstName: 'Asha',
      lastName: 'Rao',
      email: 'Asha.Rao@Example.com',
    });
    expect(createRes.status).toBe(201);
    expect(createRes.body.data.companyId).toBe(company.id);
    expect(createRes.body.data.lifecycleStatus).toBe('ACTIVE');
    expect(createRes.body.duplicates).toEqual([]);
    const contactId = createRes.body.data.id as string;

    const getRes = await api.get(`/api/v1/contacts/${contactId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.firstName).toBe('Asha');

    const listRes = await api.get(`/api/v1/contacts?companyId=${company.id}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.some((c: { id: string }) => c.id === contactId)).toBe(true);

    const patchRes = await api.patch(`/api/v1/contacts/${contactId}`, { jobTitle: 'Operations Lead' });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.jobTitle).toBe('Operations Lead');

    const archiveRes = await api.post(`/api/v1/contacts/${contactId}/archive`);
    expect(archiveRes.status).toBe(200);
    expect(archiveRes.body.data.archivedAt).not.toBeNull();

    const hiddenRes = await api.get('/api/v1/contacts');
    expect(hiddenRes.body.data.some((c: { id: string }) => c.id === contactId)).toBe(false);

    const restoreRes = await api.post(`/api/v1/contacts/${contactId}/restore`);
    expect(restoreRes.status).toBe(200);
    expect(restoreRes.body.data.archivedAt).toBeNull();
  });

  it('a contact can be created with no company at all', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();
    const api = authed(app, token);

    const res = await api.post('/api/v1/contacts', { firstName: 'Independent' });
    expect(res.status).toBe(201);
    expect(res.body.data.companyId).toBeNull();
  });

  it('rejects a companyId that does not belong to the organisation (404)', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();
    const api = authed(app, token);

    const res = await api.post('/api/v1/contacts', {
      firstName: 'Orphan',
      companyId: '00000000-0000-7000-8000-000000000000',
    });
    expect(res.status).toBe(404);
  });

  it('Staff can create, edit, archive, and restore contacts (D29)', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.staffUser.id);
    const app = createApp();
    const api = authed(app, token);

    const createRes = await api.post('/api/v1/contacts', { firstName: 'Staff Created' });
    expect(createRes.status).toBe(201);
    const contactId = createRes.body.data.id as string;

    expect((await api.patch(`/api/v1/contacts/${contactId}`, { lastName: 'Contact' })).status).toBe(200);
    expect((await api.post(`/api/v1/contacts/${contactId}/archive`)).status).toBe(200);
    expect((await api.post(`/api/v1/contacts/${contactId}/restore`)).status).toBe(200);
  });

  it('warns about a duplicate email but still saves, without blocking (D29)', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();
    const api = authed(app, token);

    await api.post('/api/v1/contacts', { firstName: 'First', email: 'shared@example.com' });
    const secondRes = await api.post('/api/v1/contacts', { firstName: 'Second', email: 'Shared@Example.com' });

    expect(secondRes.status).toBe(201);
    expect(secondRes.body.duplicates.length).toBe(1);
    expect(secondRes.body.duplicates[0].reason).toBe('email');
  });

  it('rejects a create body with a blank first name (422)', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();
    const api = authed(app, token);

    const res = await api.post('/api/v1/contacts', { firstName: '   ' });
    expect(res.status).toBe(422);
  });

  it('archiving an already-archived contact returns 409 ALREADY_ARCHIVED; restoring a non-archived one returns 409 NOT_ARCHIVED', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();
    const api = authed(app, token);

    const createRes = await api.post('/api/v1/contacts', { firstName: 'Double Archive' });
    const contactId = createRes.body.data.id as string;

    const notArchivedRes = await api.post(`/api/v1/contacts/${contactId}/restore`);
    expect(notArchivedRes.status).toBe(409);
    expect(notArchivedRes.body.error.code).toBe('NOT_ARCHIVED');

    await api.post(`/api/v1/contacts/${contactId}/archive`);
    const alreadyArchivedRes = await api.post(`/api/v1/contacts/${contactId}/archive`);
    expect(alreadyArchivedRes.status).toBe(409);
    expect(alreadyArchivedRes.body.error.code).toBe('ALREADY_ARCHIVED');
  });

  it('GET /api/v1/contacts/:id returns 404 for an id that does not exist', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();
    const api = authed(app, token);

    const res = await api.get('/api/v1/contacts/00000000-0000-7000-8000-000000000000');
    expect(res.status).toBe(404);
  });

  it('can re-point a contact to a different company, or detach it, via PATCH', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();
    const api = authed(app, token);

    const companyA = await prisma.company.create({
      data: { organizationId: tenant.organization.id, name: 'A Co', nameNormalized: 'a' },
    });
    const companyB = await prisma.company.create({
      data: { organizationId: tenant.organization.id, name: 'B Co', nameNormalized: 'b' },
    });

    const createRes = await api.post('/api/v1/contacts', { firstName: 'Movable', companyId: companyA.id });
    const contactId = createRes.body.data.id as string;

    const moveRes = await api.patch(`/api/v1/contacts/${contactId}`, { companyId: companyB.id });
    expect(moveRes.status).toBe(200);
    expect(moveRes.body.data.companyId).toBe(companyB.id);

    const detachRes = await api.patch(`/api/v1/contacts/${contactId}`, { companyId: null });
    expect(detachRes.status).toBe(200);
    expect(detachRes.body.data.companyId).toBeNull();
  });

  it('D41: accepts a valid E.164 +91 phone, and rejects one with 11+ digits (422)', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();
    const api = authed(app, token);

    const validRes = await api.post('/api/v1/contacts', { firstName: 'Valid Phone', phone: '+919876543210' });
    expect(validRes.status).toBe(201);

    const invalidRes = await api.post('/api/v1/contacts', {
      firstName: 'Too Many Digits',
      phone: '+9198765432109',
    });
    expect(invalidRes.status).toBe(422);
  });
});
