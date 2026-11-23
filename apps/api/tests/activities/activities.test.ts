import { describe, expect, it, vi } from 'vitest';
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
  it('filters due ranges and overdue activities using the organisation day boundary', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-21T18:00:00.000Z')); // 23:30 Asia/Kolkata
    try {
      const tenant = await createTestTenant();
      const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
      const company = await prisma.company.create({ data: { organizationId: tenant.organization.id, name: 'Boundary Co', nameNormalized: 'boundary co' } });
      const at2330 = new Date('2026-11-21T18:00:00.000Z');
      const at0030 = new Date('2026-11-21T19:00:00.000Z');
      const old = new Date('2026-11-21T17:29:00.000Z');
      const makeActivity = (subject: string, dueAt: Date, overrides: { status?: 'OPEN' | 'DONE' | 'CANCELLED'; type?: 'TASK' | 'NOTE' } = {}) =>
        prisma.activity.create({ data: {
          organizationId: tenant.organization.id, type: overrides.type ?? 'TASK', subject,
          status: overrides.status ?? 'OPEN', completedAt: overrides.status === 'DONE' ? new Date() : null,
          dueAt, companyId: company.id, createdById: tenant.adminUser.id,
          assigneeId: tenant.adminUser.id,
        } });
      const [beforeMidnight, afterMidnight, older, completed, cancelled, note] = await Promise.all([
        makeActivity('Due at 23:30', at2330), makeActivity('Due at 00:30', at0030), makeActivity('Prior day', old),
        makeActivity('Done task', old, { status: 'DONE' }), makeActivity('Cancelled task', old, { status: 'CANCELLED' }),
        makeActivity('Note', old, { type: 'NOTE' }),
      ]);

      const before = await api(token).get('/api/v1/activities?overdue=true');
      expect(before.status).toBe(200);
      expect(before.body.data.map((row: { id: string }) => row.id)).not.toContain(beforeMidnight.id);
      expect(before.body.data.map((row: { id: string }) => row.id)).not.toContain(afterMidnight.id);

      vi.setSystemTime(new Date('2026-11-21T19:00:00.000Z')); // 00:30 next local day
      const after = await api(token).get('/api/v1/activities?overdue=true');
      expect(after.status).toBe(200);
      const overdueIds = after.body.data.map((row: { id: string }) => row.id);
      expect(overdueIds).toContain(beforeMidnight.id);
      expect(overdueIds).toContain(older.id);
      expect(overdueIds).not.toContain(afterMidnight.id);
      expect(overdueIds).not.toContain(completed.id);
      expect(overdueIds).not.toContain(cancelled.id);
      expect(overdueIds).not.toContain(note.id);

      const range = await api(token).get(`/api/v1/activities?dueFrom=${at2330.toISOString()}&dueTo=${at0030.toISOString()}&assigneeId=${tenant.adminUser.id}&status=OPEN&type=TASK&companyId=${company.id}&sort=dueAt:asc`);
      expect(range.status).toBe(200);
      expect(range.body.data.map((row: { id: string }) => row.id)).toEqual([beforeMidnight.id, afterMidnight.id]);
      const invalidRange = await api(token).get(`/api/v1/activities?dueFrom=${at0030.toISOString()}&dueTo=${at2330.toISOString()}`);
      expect(invalidRange.status).toBe(422);
    } finally {
      vi.useRealTimers();
    }
  });

  it('returns nextActivity on lead and deal details, including overdue but excluding done, cancelled and notes', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const company = await prisma.company.create({ data: { organizationId: tenant.organization.id, name: 'Next Activity Co', nameNormalized: 'next activity co' } });
    const lead = await prisma.lead.create({ data: {
      organizationId: tenant.organization.id, firstName: 'Next', sourceId: tenant.leadSource.id,
      email: 'next@example.test', emailNormalized: 'next@example.test',
    } });
    const deal = await prisma.deal.create({ data: {
      organizationId: tenant.organization.id, name: 'Next Activity Deal', companyId: company.id,
      pipelineId: tenant.pipeline.id, stageId: tenant.stages[0]!.id, probability: 10,
    } });
    const now = new Date();
    const overdueAt = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const laterAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    await prisma.activity.createMany({ data: [
      { organizationId: tenant.organization.id, type: 'TASK', subject: 'Overdue lead task', status: 'OPEN', dueAt: overdueAt, leadId: lead.id, createdById: tenant.adminUser.id },
      { organizationId: tenant.organization.id, type: 'CALL', subject: 'Later lead call', status: 'OPEN', dueAt: laterAt, leadId: lead.id, createdById: tenant.adminUser.id },
      { organizationId: tenant.organization.id, type: 'TASK', subject: 'Done lead task', status: 'DONE', completedAt: now, dueAt: new Date(overdueAt.getTime() - 1000), leadId: lead.id, createdById: tenant.adminUser.id },
      { organizationId: tenant.organization.id, type: 'CALL', subject: 'Cancelled lead call', status: 'CANCELLED', dueAt: new Date(overdueAt.getTime() - 2000), leadId: lead.id, createdById: tenant.adminUser.id },
      { organizationId: tenant.organization.id, type: 'NOTE', subject: 'Lead note', status: 'DONE', completedAt: now, leadId: lead.id, createdById: tenant.adminUser.id },
      { organizationId: tenant.organization.id, type: 'MEETING', subject: 'Deal meeting', status: 'OPEN', dueAt: laterAt, dealId: deal.id, companyId: company.id, createdById: tenant.adminUser.id },
      { organizationId: tenant.organization.id, type: 'TASK', subject: 'Done deal task', status: 'DONE', completedAt: now, dueAt: overdueAt, dealId: deal.id, companyId: company.id, createdById: tenant.adminUser.id },
      { organizationId: tenant.organization.id, type: 'CALL', subject: 'Cancelled deal call', status: 'CANCELLED', dueAt: overdueAt, dealId: deal.id, companyId: company.id, createdById: tenant.adminUser.id },
    ] });

    const leadResponse = await api(token).get(`/api/v1/leads/${lead.id}`);
    expect(leadResponse.status).toBe(200);
    expect(leadResponse.body.data.nextActivity).toEqual({ type: 'TASK', subject: 'Overdue lead task', dueAt: overdueAt.toISOString(), isOverdue: true });
    const dealResponse = await api(token).get(`/api/v1/deals/${deal.id}`);
    expect(dealResponse.status).toBe(200);
    expect(dealResponse.body.data.nextActivity).toEqual({ type: 'MEETING', subject: 'Deal meeting', dueAt: laterAt.toISOString(), isOverdue: false });
    const emptyLead = await prisma.lead.create({ data: {
      organizationId: tenant.organization.id, firstName: 'No next action', sourceId: tenant.leadSource.id,
      email: 'no.next.action@example.test', emailNormalized: 'no.next.action@example.test',
    } });
    expect((await api(token).get(`/api/v1/leads/${emptyLead.id}`)).body.data.nextActivity).toBeNull();
  });

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

  it('filters a list of activities by priority', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const company = await prisma.company.create({ data: { organizationId: tenant.organization.id, name: 'Priority Co', nameNormalized: 'priority co' } });
    const high = await prisma.activity.create({ data: { organizationId: tenant.organization.id, type: 'TASK', subject: 'High priority', status: 'OPEN', priority: 'HIGH', companyId: company.id, createdById: tenant.adminUser.id } });
    const low = await prisma.activity.create({ data: { organizationId: tenant.organization.id, type: 'TASK', subject: 'Low priority', status: 'OPEN', priority: 'LOW', companyId: company.id, createdById: tenant.adminUser.id } });

    const response = await api(token).get('/api/v1/activities?priority=HIGH');
    expect(response.status).toBe(200);
    const ids = response.body.data.map((row: { id: string }) => row.id);
    expect(ids).toContain(high.id);
    expect(ids).not.toContain(low.id);
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

  it('includes the completing actor and completion time in activity timeline entries', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const lead = await prisma.lead.create({ data: {
      organizationId: tenant.organization.id, firstName: 'Completion', sourceId: tenant.leadSource.id,
      email: 'completion@example.test', emailNormalized: 'completion@example.test',
    } });
    const created = await api(token).post('/api/v1/activities').send({ type: 'TASK', subject: 'Review quote', leadId: lead.id });
    await api(token).post(`/api/v1/activities/${created.body.data.id}/complete`);
    const timeline = await api(token).get(`/api/v1/leads/${lead.id}/timeline`);
    expect(timeline.body.data[0]).toMatchObject({
      status: 'DONE', completedByName: tenant.adminUser.name,
    });
    expect(timeline.body.data[0].completedAt).toBeTruthy();
  });

  it('merges contact, company and deal timelines with mixed lead conversion and deal-stage history in order', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const company = await prisma.company.create({ data: { organizationId: tenant.organization.id, name: 'Timeline Co', nameNormalized: 'timeline co' } });
    const contact = await prisma.contact.create({ data: { organizationId: tenant.organization.id, companyId: company.id, firstName: 'Timeline', email: 'timeline.contact@example.test', emailNormalized: 'timeline.contact@example.test' } });
    const lead = await prisma.lead.create({ data: {
      organizationId: tenant.organization.id, firstName: 'Converted timeline', sourceId: tenant.leadSource.id,
      email: 'converted.timeline@example.test', emailNormalized: 'converted.timeline@example.test',
    } });
    const deal = await prisma.deal.create({ data: {
      organizationId: tenant.organization.id, name: 'Timeline deal', companyId: company.id,
      pipelineId: tenant.pipeline.id, stageId: tenant.stages[0]!.id, probability: 10,
    } });
    const base = Date.now() - 60_000;
    const at = (offset: number) => new Date(base + offset);
    await prisma.leadStatusHistory.create({ data: {
      organizationId: tenant.organization.id, leadId: lead.id, fromStatus: 'QUALIFIED', toStatus: 'CONVERTED',
      changedById: tenant.adminUser.id, createdAt: at(10),
    } });
    await prisma.leadConversion.create({ data: {
      organizationId: tenant.organization.id, leadId: lead.id, companyId: company.id, contactId: contact.id,
      dealId: deal.id, createdCompany: false, createdContact: false, convertedById: tenant.adminUser.id, createdAt: at(40),
    } });
    await prisma.dealStageHistory.create({ data: {
      organizationId: tenant.organization.id, dealId: deal.id, fromStageId: null, toStageId: tenant.stages[0]!.id,
      changedById: tenant.adminUser.id, createdAt: at(20),
    } });
    await prisma.dealContact.create({ data: { organizationId: tenant.organization.id, dealId: deal.id, contactId: contact.id, isPrimary: true } });
    const createHistoryActivity = (subject: string, links: { leadId?: string; contactId?: string; companyId?: string; dealId?: string }, createdAt: Date) =>
      prisma.activity.create({ data: {
        organizationId: tenant.organization.id, type: 'CALL', subject, status: 'OPEN', createdAt,
        createdById: tenant.adminUser.id, ...links,
      } });
    await Promise.all([
      createHistoryActivity('Lead activity one', { leadId: lead.id }, at(15)),
      createHistoryActivity('Lead activity two', { leadId: lead.id }, at(30)),
      createHistoryActivity('Contact activity', { contactId: contact.id }, at(11)),
      createHistoryActivity('Company activity', { companyId: company.id }, at(12)),
      createHistoryActivity('Deal activity', { dealId: deal.id, companyId: company.id }, at(25)),
    ]);

    const leadTimeline = await api(token).get(`/api/v1/leads/${lead.id}/timeline`);
    expect(leadTimeline.body.data.map((entry: { kind: string }) => entry.kind)).toEqual(['CONVERSION', 'ACTIVITY', 'ACTIVITY', 'LEAD_STATUS']);
    const dealTimeline = await api(token).get(`/api/v1/deals/${deal.id}/timeline`);
    expect(dealTimeline.body.data.map((entry: { kind: string }) => entry.kind)).toEqual(['ACTIVITY', 'DEAL_STAGE']);
    const contactTimeline = await api(token).get(`/api/v1/contacts/${contact.id}/timeline`);
    expect(contactTimeline.body.data.map((entry: { title: string }) => entry.title)).toContain('CALL: Contact activity');
    expect(contactTimeline.body.data.map((entry: { title: string }) => entry.title)).toContain('CALL: Deal activity');
    const companyTimeline = await api(token).get(`/api/v1/companies/${company.id}/timeline`);
    expect(companyTimeline.body.data.map((entry: { title: string }) => entry.title)).toEqual(['CALL: Deal activity', 'CALL: Company activity']);
  });
});
