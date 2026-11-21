import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';
import { createTestTenant, createTwoTestTenants } from '../helpers/tenant.js';
import { createSession } from '../../src/lib/session.js';
import { ALLOWED_ORIGIN, sessionCookieHeader } from '../helpers/http.js';

function api(token: string) {
  const cookie = sessionCookieHeader(token);
  return {
    get: (path: string) => request(createApp()).get(path).set('Cookie', cookie),
    post: (path: string, body?: object) => request(createApp()).post(path).set('Origin', ALLOWED_ORIGIN).set('Cookie', cookie).send(body ?? {}),
  };
}

describe('Activities API', () => {
  it('requires a link, rejects cross-organisation links, and carries a deal company onto the activity', async () => {
    const [a, b] = await createTwoTestTenants();
    const { token } = await createSession(a.organization.id, a.adminUser.id);
    const company = await prisma.company.create({ data: { organizationId: b.organization.id, name: 'Other tenant', nameNormalized: 'other tenant' } });
    const noLink = await api(token).post('/api/v1/activities', { type: 'TASK', subject: 'Unlinked' });
    expect(noLink.status).toBe(422);
    const crossOrg = await api(token).post('/api/v1/activities', { type: 'TASK', subject: 'Cross org', companyId: company.id });
    expect(crossOrg.status).toBe(404);

    const ownCompany = await prisma.company.create({ data: { organizationId: a.organization.id, name: 'Acme', nameNormalized: 'acme' } });
    const deal = await prisma.deal.create({ data: { organizationId: a.organization.id, name: 'Acme deal', companyId: ownCompany.id, pipelineId: a.pipeline.id, stageId: a.stages[0]!.id, probability: 10 } });
    const created = await api(token).post('/api/v1/activities', { type: 'CALL', subject: 'Call', dealId: deal.id });
    expect(created.status).toBe(201);
    expect(created.body.data.companyId).toBe(ownCompany.id);
  });

  it('completes once, gives notes DONE status, and allows Staff read/write', async () => {
    const tenant = await createTestTenant();
    const company = await prisma.company.create({ data: { organizationId: tenant.organization.id, name: 'Acme', nameNormalized: 'acme' } });
    const [adminSession, staffSession] = await Promise.all([
      createSession(tenant.organization.id, tenant.adminUser.id), createSession(tenant.organization.id, tenant.staffUser.id),
    ]);
    const created = await api(adminSession.token).post('/api/v1/activities', { type: 'TASK', subject: 'Follow up', companyId: company.id });
    const id = created.body.data.id as string;
    const completed = await api(adminSession.token).post(`/api/v1/activities/${id}/complete`);
    expect(completed.status).toBe(200);
    expect(completed.body.data.status).toBe('DONE');
    expect(completed.body.data.completedAt).toBeTruthy();
    expect((await api(adminSession.token).post(`/api/v1/activities/${id}/complete`)).status).toBe(409);
    const note = await api(adminSession.token).post('/api/v1/activities', { type: 'NOTE', subject: 'Note', companyId: company.id });
    expect(note.body.data.status).toBe('DONE');
    expect((await api(staffSession.token).get('/api/v1/activities')).status).toBe(200);
    const staffWrite = await api(staffSession.token).post('/api/v1/activities', { type: 'TASK', subject: 'Staff task', companyId: company.id });
    expect(staffWrite.status).toBe(201);
  });

  it('merges activity and lead status history newest-first and computes next activity', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const lead = await prisma.lead.create({ data: {
      organizationId: tenant.organization.id, firstName: 'Timeline', sourceId: tenant.leadSource.id,
      email: 'timeline@example.test', emailNormalized: 'timeline@example.test',
    } });
    await prisma.leadStatusHistory.create({ data: {
      organizationId: tenant.organization.id, leadId: lead.id, fromStatus: null,
      toStatus: 'NEW', changedById: tenant.adminUser.id,
    } });
    await api(token).post('/api/v1/activities', {
      type: 'TASK', subject: 'Follow up', leadId: lead.id, dueAt: '2026-11-22T10:00:00.000Z',
    });
    const timeline = await api(token).get(`/api/v1/leads/${lead.id}/timeline`);
    expect(timeline.status).toBe(200);
    expect(timeline.body.data.map((entry: { kind: string }) => entry.kind)).toEqual(['ACTIVITY', 'LEAD_STATUS']);
    expect(timeline.body.nextActivity.subject).toBe('Follow up');
  });
});
