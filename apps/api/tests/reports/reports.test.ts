import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';
import { createTestTenant, createTwoTestTenants, type TestTenant } from '../helpers/tenant.js';
import { signIn } from '../helpers/quotations.js';
import { pastMonth, seedActivity, seedCompany, seedContact, seedDeal, seedLead, seedQuotation } from '../helpers/reports.js';

const W = pastMonth();
const day = (n: number) => `${W.from.slice(0, 8)}${String(n).padStart(2, '0')}`;
const rangeQuery = `from=${W.from}&to=${W.to}`;

function todayKeyIst(offsetDays = 0): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(Date.now() + offsetDays * 86_400_000));
}

describe('Reports: lead sources and conversion', () => {
  async function seed(tenant: TestTenant) {
    const referral = await prisma.leadSource.create({ data: { organizationId: tenant.organization.id, name: 'Referral', sortOrder: 2 } });
    const admin = tenant.adminUser.id;
    await seedLead(tenant, { createdAt: W.on(5), ownerId: admin });
    await seedLead(tenant, { createdAt: W.on(10), status: 'CONVERTED', ownerId: tenant.staffUser.id });
    await seedLead(tenant, { createdAt: W.firstMinuteIst, status: 'QUALIFIED', ownerId: admin }); // 00:30 IST on the 1st: inside
    await seedLead(tenant, { createdAt: W.on(12), status: 'CONVERTED', ownerId: admin, sourceId: referral.id });
    // Outside: 23:30 IST the day before, earlier, later, archived.
    await seedLead(tenant, { createdAt: W.justBefore, ownerId: admin });
    await seedLead(tenant, { createdAt: W.before, ownerId: admin });
    await seedLead(tenant, { createdAt: W.after, ownerId: admin });
    await seedLead(tenant, { createdAt: W.on(6), ownerId: admin, archived: true });
  }

  it('counts leads created in the range by source (organisation calendar days), converted among them, and the rate', async () => {
    const tenant = await createTestTenant();
    await seed(tenant);
    const res = await (await signIn(createApp(), tenant)).get(`/api/v1/reports?${rangeQuery}`);
    expect(res.status).toBe(200);
    expect(res.body.data.range).toEqual({ from: W.from, to: W.to });
    expect(res.body.data.leadSources).toEqual({
      rows: [
        { sourceId: tenant.leadSource.id, sourceName: tenant.leadSource.name, created: 3, converted: 1, conversionRate: '33.33' },
        { sourceId: expect.any(String), sourceName: 'Referral', created: 1, converted: 1, conversionRate: '100.00' },
      ],
      totals: { created: 4, converted: 2, conversionRate: '50.00' },
    });
  });

  it('scope=mine narrows to the caller\'s own leads', async () => {
    const tenant = await createTestTenant();
    await seed(tenant);
    const res = await (await signIn(createApp(), tenant)).get(`/api/v1/reports?${rangeQuery}&scope=mine`);
    expect(res.body.data.scope).toBe('mine');
    expect(res.body.data.leadSources.totals).toEqual({ created: 3, converted: 1, conversionRate: '33.33' });
    expect(res.body.data.leadSources.rows.map((r: { created: number }) => r.created)).toEqual([2, 1]);
  });
});

describe('Reports: sales performance by owner', () => {
  it('groups deals closed in the range by owner: won count and value, lost count, win rate; unassigned kept; archived and out-of-range excluded', async () => {
    const tenant = await createTestTenant();
    const company = await seedCompany(tenant);
    const admin = tenant.adminUser.id;
    const staff = tenant.staffUser.id;
    await seedDeal(tenant, company.id, { value: '1000.50', status: 'WON', closedAt: W.on(3), ownerId: admin });
    await seedDeal(tenant, company.id, { value: '2000.00', status: 'WON', closedAt: W.on(4), ownerId: staff });
    await seedDeal(tenant, company.id, { value: '999.00', status: 'LOST', closedAt: W.on(7), ownerId: staff });
    await seedDeal(tenant, company.id, { value: '500.00', status: 'WON', closedAt: W.on(8), ownerId: null });
    await seedDeal(tenant, company.id, { value: '7777.00', status: 'WON', closedAt: W.on(9), ownerId: admin, archived: true });
    await seedDeal(tenant, company.id, { value: '8888.00', status: 'WON', closedAt: W.before, ownerId: admin });
    await seedDeal(tenant, company.id, { value: '9999.00', ownerId: admin }); // open

    const res = await (await signIn(createApp(), tenant)).get(`/api/v1/reports?${rangeQuery}`);
    expect(res.body.data.salesByOwner).toEqual({
      rows: [
        { ownerId: staff, ownerName: 'Test Staff', wonCount: 1, wonValue: '2000.00', lostCount: 1, winRate: '50.00' },
        { ownerId: admin, ownerName: 'Test Admin', wonCount: 1, wonValue: '1000.50', lostCount: 0, winRate: '100.00' },
        { ownerId: null, ownerName: null, wonCount: 1, wonValue: '500.00', lostCount: 0, winRate: '100.00' },
      ],
      totals: { wonCount: 3, wonValue: '3500.50', lostCount: 1, winRate: '75.00' },
    });

    const mine = await (await signIn(createApp(), tenant, 'staff')).get(`/api/v1/reports?${rangeQuery}&scope=mine`);
    expect(mine.body.data.salesByOwner.rows).toHaveLength(1);
    expect(mine.body.data.salesByOwner.totals).toEqual({ wonCount: 1, wonValue: '2000.00', lostCount: 1, winRate: '50.00' });
  });
});

describe('Reports: pipeline by stage', () => {
  it('is the current open snapshot by open stage (date range ignored): count, value and weighted value', async () => {
    const tenant = await createTestTenant();
    const company = await seedCompany(tenant);
    await seedDeal(tenant, company.id, { value: '100.00', stageIndex: 0 });
    await seedDeal(tenant, company.id, { value: '300.00', stageIndex: 1, ownerId: tenant.staffUser.id });
    await seedDeal(tenant, company.id, { value: '200.00', stageIndex: 1, archived: true });
    await seedDeal(tenant, company.id, { value: '5000.00', status: 'WON', closedAt: W.on(3) });

    const res = await (await signIn(createApp(), tenant)).get(`/api/v1/reports?${rangeQuery}`);
    const { stages, totals } = res.body.data.pipelineByStage;
    expect(stages.map((s: { name: string }) => s.name)).toEqual(['Qualification', 'Needs Analysis', 'Proposal', 'Negotiation']);
    expect(stages.slice(0, 2).map((s: { count: number; totalValue: string; weightedValue: string }) => [s.count, s.totalValue, s.weightedValue])).toEqual([
      [1, '100.00', '10.00'],
      [1, '300.00', '75.00'],
    ]);
    expect(totals).toEqual({ count: 2, totalValue: '400.00', weightedValue: '85.00' });

    const mine = await (await signIn(createApp(), tenant, 'staff')).get('/api/v1/reports?scope=mine');
    expect(mine.body.data.pipelineByStage.totals).toEqual({ count: 1, totalValue: '300.00', weightedValue: '75.00' });
  });
});

describe('Reports: quotations summary', () => {
  it('counts and values quotations issued in the range by EFFECTIVE status (a lapsed Sent counts as Expired), without writing anything', async () => {
    const tenant = await createTestTenant();
    const company = await seedCompany(tenant);
    const contact = await seedContact(tenant, company.id);
    const refs = { companyId: company.id, contactId: contact.id };
    const future = todayKeyIst(30);
    await seedQuotation(tenant, refs, { issueDate: day(5), validUntil: future, total: '100.00' });
    await seedQuotation(tenant, refs, { issueDate: day(6), validUntil: future, total: '200.00', status: 'SENT' });
    const lapsed = await seedQuotation(tenant, refs, { issueDate: day(6), validUntil: day(20), total: '300.00', status: 'SENT' });
    await seedQuotation(tenant, refs, { issueDate: day(7), validUntil: day(8), total: '50.00', status: 'EXPIRED' });
    await seedQuotation(tenant, refs, { issueDate: W.to, validUntil: future, total: '400.00', status: 'ACCEPTED', ownerId: tenant.staffUser.id });
    await seedQuotation(tenant, refs, { issueDate: day(9), validUntil: future, total: '25.00', status: 'REJECTED', archived: true });
    await seedQuotation(tenant, refs, { issueDate: W.before.toISOString().slice(0, 10), validUntil: future, total: '60.00', status: 'REJECTED' });

    const res = await (await signIn(createApp(), tenant)).get(`/api/v1/reports?${rangeQuery}`);
    expect(res.body.data.quotations).toEqual({
      rows: [
        { status: 'DRAFT', count: 1, value: '100.00' },
        { status: 'SENT', count: 1, value: '200.00' },
        { status: 'ACCEPTED', count: 1, value: '400.00' },
        { status: 'REJECTED', count: 0, value: '0.00' },
        { status: 'EXPIRED', count: 2, value: '350.00' },
      ],
      totals: { count: 5, value: '1050.00' },
    });
    // Read-only: the lapsed quotation is still stored as SENT, with no audit row.
    expect((await prisma.quotation.findUniqueOrThrow({ where: { id: lapsed.id } })).status).toBe('SENT');
    expect(await prisma.auditEvent.count({ where: { action: 'quotation.expired' } })).toBe(0);

    const mine = await (await signIn(createApp(), tenant, 'staff')).get(`/api/v1/reports?${rangeQuery}&scope=mine`);
    expect(mine.body.data.quotations.totals).toEqual({ count: 1, value: '400.00' });
  });
});

describe('Reports: overdue tasks by assignee', () => {
  it('counts open tasks/calls/meetings due before today and inside the range, by assignee, with the oldest due date', async () => {
    const tenant = await createTestTenant();
    const lead = await seedLead(tenant, { createdAt: W.before });
    await seedActivity(tenant, lead.id, { dueAt: W.on(5) });
    await seedActivity(tenant, lead.id, { dueAt: W.on(6), type: 'CALL' });
    await seedActivity(tenant, lead.id, { dueAt: W.on(9), type: 'MEETING', assigneeId: tenant.adminUser.id });
    await seedActivity(tenant, lead.id, { dueAt: W.on(10), assigneeId: null });
    await seedActivity(tenant, lead.id, { dueAt: W.on(11), done: true });
    await seedActivity(tenant, lead.id, { dueAt: W.on(12), type: 'NOTE' });
    await seedActivity(tenant, lead.id, { dueAt: W.before });

    const res = await (await signIn(createApp(), tenant)).get(`/api/v1/reports?${rangeQuery}`);
    expect(res.body.data.overdueTasks).toEqual({
      rows: [
        { assigneeId: tenant.staffUser.id, assigneeName: 'Test Staff', count: 2, oldestDueAt: W.on(5).toISOString() },
        { assigneeId: tenant.adminUser.id, assigneeName: 'Test Admin', count: 1, oldestDueAt: W.on(9).toISOString() },
        { assigneeId: null, assigneeName: null, count: 1, oldestDueAt: W.on(10).toISOString() },
      ],
      totals: { count: 4 },
    });

    const mine = await (await signIn(createApp(), tenant, 'staff')).get(`/api/v1/reports?${rangeQuery}&scope=mine`);
    expect(mine.body.data.overdueTasks.totals).toEqual({ count: 2 });
  });

  it('a task due later today is not overdue', async () => {
    const tenant = await createTestTenant();
    const lead = await seedLead(tenant, { createdAt: W.before });
    const endOfTodayIst = new Date(`${todayKeyIst()}T18:29:00.000Z`); // 23:59 IST today
    await seedActivity(tenant, lead.id, { dueAt: endOfTodayIst });
    const res = await (await signIn(createApp(), tenant)).get(`/api/v1/reports?from=2000-01-01&to=${todayKeyIst()}`);
    expect(res.body.data.overdueTasks.totals.count).toBe(0);
  });
});

describe('Reports: access, range and isolation', () => {
  it('Staff can read reports (reports:read); signed-out is 401', async () => {
    const tenant = await createTestTenant();
    expect((await (await signIn(createApp(), tenant, 'staff')).get('/api/v1/reports')).status).toBe(200);
    expect((await request(createApp()).get('/api/v1/reports')).status).toBe(401);
  });

  it('defaults to the organisation\'s current month, a single date means that one day, and from after to is a 422', async () => {
    const tenant = await createTestTenant();
    const api = await signIn(createApp(), tenant);
    const today = todayKeyIst();
    const defaulted = await api.get('/api/v1/reports');
    expect(defaulted.body.data.range.from).toBe(`${today.slice(0, 8)}01`);
    expect(defaulted.body.data.range.to.slice(0, 7)).toBe(today.slice(0, 7));
    expect((await api.get(`/api/v1/reports?from=${W.from}`)).body.data.range).toEqual({ from: W.from, to: W.from });
    expect((await api.get(`/api/v1/reports?from=${W.to}&to=${W.from}`)).status).toBe(422);
    expect((await api.get('/api/v1/reports?scope=everyone')).status).toBe(422);
  });

  it('never includes another organisation\'s data', async () => {
    const [orgA, orgB] = await createTwoTestTenants();
    const company = await seedCompany(orgB);
    const contact = await seedContact(orgB, company.id);
    const lead = await seedLead(orgB, { createdAt: W.on(5), status: 'CONVERTED' });
    await seedDeal(orgB, company.id, { value: '100.00' });
    await seedDeal(orgB, company.id, { value: '100.00', status: 'WON', closedAt: W.on(5) });
    await seedQuotation(orgB, { companyId: company.id, contactId: contact.id }, { issueDate: day(5), validUntil: todayKeyIst(30), total: '10.00' });
    await seedActivity(orgB, lead.id, { dueAt: W.on(5) });

    const res = await (await signIn(createApp(), orgA)).get(`/api/v1/reports?${rangeQuery}`);
    const data = res.body.data;
    expect(data.leadSources.totals.created).toBe(0);
    expect(data.pipelineByStage.totals.count).toBe(0);
    expect(data.salesByOwner.rows).toEqual([]);
    expect(data.quotations.totals.count).toBe(0);
    expect(data.overdueTasks.totals.count).toBe(0);
  });
});
