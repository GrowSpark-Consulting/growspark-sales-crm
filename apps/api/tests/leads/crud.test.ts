import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { createTestTenant } from '../helpers/tenant.js';
import { createSession } from '../../src/lib/session.js';
import { prisma } from '../../src/db/prisma.js';
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

describe('Leads CRUD', () => {
  it('uses the organisation-scoped Manual source when sourceId is omitted', async () => {
    const tenant = await createTestTenant();
    const manual = await prisma.leadSource.create({
      data: { organizationId: tenant.organization.id, name: 'Manual', sortOrder: 2 },
    });
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const res = await authed(createApp(), token).post('/api/v1/leads', { companyName: 'Fixture Co',
      firstName: 'No source selected', email: 'nosource@example.com',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.sourceId).toBe(manual.id);
  });

  it('creates, reads, lists, updates, archives, and restores a lead', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();
    const api = authed(app, token);

    const createRes = await api.post('/api/v1/leads', { companyName: 'Fixture Co',
      firstName: 'Asha',
      lastName: 'Rao',
      email: 'asha.rao@example.com',
      sourceId: tenant.leadSource.id,
      requirement: 'Automate order tracking.',
    });
    expect(createRes.status).toBe(201);
    expect(createRes.body.data.status).toBe('NEW');
    expect(createRes.body.data.priority).toBe('MEDIUM');
    expect(createRes.body.data.requirement).toBe('Automate order tracking.');
    expect(createRes.body.duplicates).toEqual([]);
    const leadId = createRes.body.data.id as string;

    const getRes = await api.get(`/api/v1/leads/${leadId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.lastName).toBe('Rao');

    const listRes = await api.get('/api/v1/leads');
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.some((l: { id: string }) => l.id === leadId)).toBe(true);

    const patchRes = await api.patch(`/api/v1/leads/${leadId}`, { jobTitle: 'Plant Manager' });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.jobTitle).toBe('Plant Manager');

    const archiveRes = await api.post(`/api/v1/leads/${leadId}/archive`);
    expect(archiveRes.status).toBe(200);
    expect(archiveRes.body.data.archivedAt).not.toBeNull();

    const hiddenRes = await api.get('/api/v1/leads');
    expect(hiddenRes.body.data.some((l: { id: string }) => l.id === leadId)).toBe(false);

    const archivedOnlyRes = await api.get('/api/v1/leads?archived=true');
    expect(archivedOnlyRes.body.data.some((l: { id: string }) => l.id === leadId)).toBe(true);

    const restoreRes = await api.post(`/api/v1/leads/${leadId}/restore`);
    expect(restoreRes.status).toBe(200);
    expect(restoreRes.body.data.archivedAt).toBeNull();
  });

  it('a lead can be created with only a phone, no email', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();
    const api = authed(app, token);

    const res = await api.post('/api/v1/leads', { companyName: 'Fixture Co',
      firstName: 'Phone Only',
      phone: '+919876543210',
      sourceId: tenant.leadSource.id,
    });
    expect(res.status).toBe(201);
  });

  it('rejects a lead with neither email nor phone (422)', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();
    const api = authed(app, token);

    const res = await api.post('/api/v1/leads', { companyName: 'Fixture Co', firstName: 'No Contact', sourceId: tenant.leadSource.id });
    expect(res.status).toBe(422);
  });

  it('rejects a lead with a blank first name (422)', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();
    const api = authed(app, token);

    const res = await api.post('/api/v1/leads', { companyName: 'Fixture Co',
      firstName: '  ',
      email: 'blank@example.com',
      sourceId: tenant.leadSource.id,
    });
    expect(res.status).toBe(422);
  });

  it('rejects a sourceId that does not belong to the organisation (404)', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();
    const api = authed(app, token);

    const res = await api.post('/api/v1/leads', { companyName: 'Fixture Co',
      firstName: 'Bad Source',
      email: 'bad-source@example.com',
      sourceId: '00000000-0000-7000-8000-000000000000',
    });
    expect(res.status).toBe(404);
  });

  it('requirement and capturedFields stay read-only after creation', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();
    const api = authed(app, token);

    const createRes = await api.post('/api/v1/leads', { companyName: 'Fixture Co',
      firstName: 'Immutable',
      email: 'immutable@example.com',
      sourceId: tenant.leadSource.id,
      requirement: 'Original requirement.',
      capturedFields: { team_size: '51-200' },
    });
    const leadId = createRes.body.data.id as string;

    // The update schema has no requirement/capturedFields fields at all, so
    // submitting them is simply ignored (not a validation error) — they are
    // not part of UpdateLeadInput.
    const patchRes = await api.patch(`/api/v1/leads/${leadId}`, {
      jobTitle: 'Something',
      requirement: 'Attempted overwrite.',
    });
    expect(patchRes.status).toBe(200);

    const getRes = await api.get(`/api/v1/leads/${leadId}`);
    expect(getRes.body.data.requirement).toBe('Original requirement.');
    expect(getRes.body.data.capturedFields).toEqual({ team_size: '51-200' });
  });

  it('clearing email while phone stays set is allowed; clearing both is rejected (422)', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();
    const api = authed(app, token);

    const createRes = await api.post('/api/v1/leads', { companyName: 'Fixture Co',
      firstName: 'Both Contacts',
      email: 'both@example.com',
      phone: '+919876543210',
      sourceId: tenant.leadSource.id,
    });
    const leadId = createRes.body.data.id as string;

    const clearEmailRes = await api.patch(`/api/v1/leads/${leadId}`, { email: '' });
    expect(clearEmailRes.status).toBe(200);
    expect(clearEmailRes.body.data.email).toBeNull();

    const clearBothRes = await api.patch(`/api/v1/leads/${leadId}`, { phone: '' });
    expect(clearBothRes.status).toBe(422);
  });

  it('Staff can create, edit, and archive leads (D29)', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.staffUser.id);
    const app = createApp();
    const api = authed(app, token);

    const createRes = await api.post('/api/v1/leads', { companyName: 'Fixture Co',
      firstName: 'Staff Created',
      email: 'staff-created@example.com',
      sourceId: tenant.leadSource.id,
    });
    expect(createRes.status).toBe(201);
    const leadId = createRes.body.data.id as string;

    expect((await api.patch(`/api/v1/leads/${leadId}`, { jobTitle: 'Buyer' })).status).toBe(200);
    expect((await api.post(`/api/v1/leads/${leadId}/archive`)).status).toBe(200);
    expect((await api.post(`/api/v1/leads/${leadId}/restore`)).status).toBe(200);
  });

  it('warns about a duplicate email but still saves (D29)', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();
    const api = authed(app, token);

    await api.post('/api/v1/leads', { companyName: 'Fixture Co',
      firstName: 'First',
      email: 'dup@example.com',
      sourceId: tenant.leadSource.id,
    });
    const secondRes = await api.post('/api/v1/leads', { companyName: 'Fixture Co',
      firstName: 'Second',
      email: 'Dup@Example.com',
      sourceId: tenant.leadSource.id,
    });

    expect(secondRes.status).toBe(201);
    expect(secondRes.body.duplicates.length).toBe(1);
    expect(secondRes.body.duplicates[0].reason).toBe('email');
  });

  it('GET /api/v1/leads/duplicates checks candidates without creating anything', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();
    const api = authed(app, token);

    const createRes = await api.post('/api/v1/leads', { companyName: 'Fixture Co',
      firstName: 'Existing',
      email: 'check@example.com',
      sourceId: tenant.leadSource.id,
    });
    const existingId = createRes.body.data.id as string;

    const res = await api.get('/api/v1/leads/duplicates?email=check@example.com');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([{ id: existingId, reason: 'email' }]);

    const excludedRes = await api.get(`/api/v1/leads/duplicates?email=check@example.com&excludeId=${existingId}`);
    expect(excludedRes.body.data).toEqual([]);
  });

  it('archiving an already-archived lead returns 409 ALREADY_ARCHIVED; restoring a non-archived one returns 409 NOT_ARCHIVED', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();
    const api = authed(app, token);

    const createRes = await api.post('/api/v1/leads', { companyName: 'Fixture Co',
      firstName: 'Double Archive',
      email: 'double-archive@example.com',
      sourceId: tenant.leadSource.id,
    });
    const leadId = createRes.body.data.id as string;

    const notArchivedRes = await api.post(`/api/v1/leads/${leadId}/restore`);
    expect(notArchivedRes.status).toBe(409);
    expect(notArchivedRes.body.error.code).toBe('NOT_ARCHIVED');

    await api.post(`/api/v1/leads/${leadId}/archive`);
    const alreadyArchivedRes = await api.post(`/api/v1/leads/${leadId}/archive`);
    expect(alreadyArchivedRes.status).toBe(409);
    expect(alreadyArchivedRes.body.error.code).toBe('ALREADY_ARCHIVED');
  });

  it('GET /api/v1/leads/:id returns 404 for an id that does not exist', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();
    const api = authed(app, token);

    const res = await api.get('/api/v1/leads/00000000-0000-7000-8000-000000000000');
    expect(res.status).toBe(404);
  });

  it('D41: accepts a valid E.164 +91 phone, and rejects one with 11+ digits (422)', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();
    const api = authed(app, token);

    const validRes = await api.post('/api/v1/leads', { companyName: 'Fixture Co',
      firstName: 'Valid Phone',
      phone: '+919876543210',
      sourceId: tenant.leadSource.id,
    });
    expect(validRes.status).toBe(201);

    const invalidRes = await api.post('/api/v1/leads', { companyName: 'Fixture Co',
      firstName: 'Too Many Digits',
      phone: '+9198765432109',
      sourceId: tenant.leadSource.id,
    });
    expect(invalidRes.status).toBe(422);
  });

  it('D98: a lead needs a company name on create, it cannot be blanked later, and older leads without one stay editable', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const api = authed(createApp(), token);

    for (const companyName of [undefined, '', '   ']) {
      const res = await api.post('/api/v1/leads', { firstName: 'No Company', email: 'nocompany@example.com', companyName });
      expect(res.status).toBe(422);
      expect(res.body.error.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: 'companyName', message: 'Company name is required' })]),
      );
    }
    expect(await prisma.lead.count({ where: { organizationId: tenant.organization.id } })).toBe(0);

    const created = await api.post('/api/v1/leads', { firstName: 'Has Company', email: 'has@example.com', companyName: 'Example Foods', sourceId: tenant.leadSource.id });
    expect(created.status).toBe(201);
    const leadId = created.body.data.id as string;
    const blanked = await api.patch(`/api/v1/leads/${leadId}`, { companyName: '  ' });
    expect(blanked.status).toBe(422);
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: leadId } })).companyName).toBe('Example Foods');

    // A lead from before D98 (or a website enquiry) with no company: other edits still work.
    await prisma.lead.update({ where: { id: leadId }, data: { companyName: null, companyNameNormalized: null } });
    const legacyEdit = await api.patch(`/api/v1/leads/${leadId}`, { jobTitle: 'Buyer' });
    expect(legacyEdit.status).toBe(200);
    expect(legacyEdit.body.data.companyName).toBeNull();
    const status = await api.post(`/api/v1/leads/${leadId}/status`, { status: 'CONTACTED' });
    expect(status.status).toBe(200);
  });
});
