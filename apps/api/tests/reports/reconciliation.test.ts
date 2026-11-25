import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';
import { createTestTenant, type TestTenant } from '../helpers/tenant.js';
import { signIn } from '../helpers/quotations.js';
import { pastMonth, seedActivity, seedCompany, seedContact, seedDeal, seedLead, seedQuotation } from '../helpers/reports.js';

/**
 * PRD §12: "Reports can be filtered and exported; dashboard metrics reconcile
 * with underlying data." Every figure the Reports page shares with the Home
 * dashboard must be identical for the same range and scope, and each report's
 * rows must add up to its own totals.
 */

const W = pastMonth();
const day = (n: number) => `${W.from.slice(0, 8)}${String(n).padStart(2, '0')}`;

function todayKeyIst(offsetDays = 0): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(Date.now() + offsetDays * 86_400_000));
}

/** Exact decimal sum via integer paise — never floats. */
function sumMoney(values: string[]): string {
  const paise = values.reduce((total, value) => {
    const [whole, fraction = ''] = value.split('.');
    return total + BigInt(whole!) * 100n + BigInt((fraction + '00').slice(0, 2));
  }, 0n);
  return `${paise / 100n}.${String(paise % 100n).padStart(2, '0')}`;
}

/** "100" / "100.5" / "100.50" -> "100.50", by string (exact). */
function twoDp(value: string): string {
  return sumMoney([value]);
}

/** A deliberately mixed organisation: two owners plus unassigned, every status, in and out of range, archived rows. */
async function seedMixed(tenant: TestTenant) {
  const admin = tenant.adminUser.id;
  const staff = tenant.staffUser.id;
  const referral = await prisma.leadSource.create({ data: { organizationId: tenant.organization.id, name: 'Referral', sortOrder: 2 } });
  const leadDates = [W.on(2), W.on(9), W.firstMinuteIst, W.justBefore, W.before, W.after, new Date()];
  for (const [index, createdAt] of leadDates.entries()) {
    for (const ownerId of [admin, staff, null]) {
      await seedLead(tenant, {
        createdAt,
        ownerId,
        status: index % 3 === 0 ? 'CONVERTED' : index % 3 === 1 ? 'QUALIFIED' : 'NEW',
        sourceId: index % 2 === 0 ? referral.id : tenant.leadSource.id,
        archived: index === 1 && ownerId === null,
      });
    }
  }
  const company = await seedCompany(tenant);
  const owners = [admin, staff, null];
  for (const [index, ownerId] of owners.entries()) {
    await seedDeal(tenant, company.id, { value: `${100 * (index + 1)}.25`, stageIndex: index, ownerId });
    await seedDeal(tenant, company.id, { value: '333.33', stageIndex: 3, ownerId, probability: 33 });
    await seedDeal(tenant, company.id, { value: `${1000 + index}.10`, status: 'WON', closedAt: W.on(4 + index), ownerId });
    await seedDeal(tenant, company.id, { value: '50.00', status: 'LOST', closedAt: W.on(10 + index), ownerId });
    await seedDeal(tenant, company.id, { value: '70.00', status: 'WON', closedAt: W.before, ownerId });
    await seedDeal(tenant, company.id, { value: '80.00', status: 'WON', closedAt: new Date(), ownerId });
    await seedDeal(tenant, company.id, { value: '90.00', status: 'WON', closedAt: W.on(15), ownerId, archived: true });
  }
  const contact = await seedContact(tenant, company.id);
  const refs = { companyId: company.id, contactId: contact.id };
  const future = todayKeyIst(30);
  for (const ownerId of owners) {
    await seedQuotation(tenant, refs, { issueDate: day(3), validUntil: future, total: '10.10', ownerId });
    await seedQuotation(tenant, refs, { issueDate: day(4), validUntil: future, total: '20.20', status: 'SENT', ownerId });
    await seedQuotation(tenant, refs, { issueDate: day(4), validUntil: day(25), total: '30.30', status: 'SENT', ownerId });
    await seedQuotation(tenant, refs, { issueDate: day(5), validUntil: future, total: '40.40', status: 'ACCEPTED', ownerId });
    await seedQuotation(tenant, refs, { issueDate: day(6), validUntil: future, total: '50.50', status: 'REJECTED', ownerId });
    await seedQuotation(tenant, refs, { issueDate: day(7), validUntil: day(8), total: '60.60', status: 'EXPIRED', ownerId });
  }
  const lead = await seedLead(tenant, { createdAt: W.before });
  for (const assigneeId of owners) {
    await seedActivity(tenant, lead.id, { dueAt: W.on(5), assigneeId });
    await seedActivity(tenant, lead.id, { dueAt: W.on(6), assigneeId, type: 'CALL' });
    await seedActivity(tenant, lead.id, { dueAt: W.before, assigneeId, type: 'MEETING' });
    await seedActivity(tenant, lead.id, { dueAt: W.on(7), assigneeId, done: true });
    await seedActivity(tenant, lead.id, { dueAt: new Date(Date.now() + 3 * 86_400_000), assigneeId });
  }
}

async function both(tenant: TestTenant, role: 'admin' | 'staff', query: string) {
  const api = await signIn(createApp(), tenant, role);
  const [reports, dashboard] = await Promise.all([api.get(`/api/v1/reports?${query}`), api.get(`/api/v1/dashboard?${query}`)]);
  expect(reports.status).toBe(200);
  expect(dashboard.status).toBe(200);
  return { r: reports.body.data, d: dashboard.body.data, api };
}

describe('Reports reconcile with the Home dashboard and with themselves', () => {
  for (const [label, role, scope] of [
    ['All', 'admin', 'all'],
    ['Mine (Admin)', 'admin', 'mine'],
    ['Mine (Staff)', 'staff', 'mine'],
  ] as const) {
    it(`${label}: every shared figure is identical to GET /dashboard for the same range, and rows add up to totals`, async () => {
      const tenant = await createTestTenant();
      await seedMixed(tenant);
      const { r, d, api } = await both(tenant, role, `from=${W.from}&to=${W.to}&scope=${scope}`);

      expect(r.range).toEqual(d.range);

      // Lead sources and conversion vs Home's leadsCreated / leadConversionRate.
      expect(r.leadSources.totals.created).toBe(d.metrics.leadsCreated);
      expect(r.leadSources.totals.conversionRate).toBe(d.metrics.leadConversionRate);
      expect(r.leadSources.rows.reduce((n: number, row: { created: number }) => n + row.created, 0)).toBe(r.leadSources.totals.created);
      expect(r.leadSources.rows.reduce((n: number, row: { converted: number }) => n + row.converted, 0)).toBe(r.leadSources.totals.converted);
      expect(r.leadSources.totals.created).toBeGreaterThan(0);

      // Pipeline vs Home's openDeals and pipelineByStage (Reports always
      // prints 2 dp; Home passes "100" through, so compare as exact decimals).
      expect(r.pipelineByStage.totals).toEqual({ count: d.metrics.openDeals.count, totalValue: twoDp(d.metrics.openDeals.value), weightedValue: twoDp(d.metrics.openDeals.weightedValue) });
      const homeOpenStages = d.pipelineByStage.stages
        .filter((stage: { type: string }) => stage.type === 'OPEN')
        .map(({ stageId, name, position, count, totalValue, weightedValue }: Record<string, string>) => ({
          stageId, name, position, count, totalValue: twoDp(totalValue!), weightedValue: twoDp(weightedValue!),
        }));
      expect(r.pipelineByStage.stages).toEqual(homeOpenStages);
      expect(sumMoney(r.pipelineByStage.stages.map((s: { totalValue: string }) => s.totalValue))).toBe(r.pipelineByStage.totals.totalValue);

      // Sales by owner vs Home's won/lost/won revenue/win rate.
      expect(r.salesByOwner.totals).toEqual({ wonCount: d.metrics.wonDeals, wonValue: d.metrics.wonRevenue, lostCount: d.metrics.lostDeals, winRate: d.metrics.winRate });
      expect(r.salesByOwner.rows.reduce((n: number, row: { wonCount: number }) => n + row.wonCount, 0)).toBe(r.salesByOwner.totals.wonCount);
      expect(r.salesByOwner.rows.reduce((n: number, row: { lostCount: number }) => n + row.lostCount, 0)).toBe(r.salesByOwner.totals.lostCount);
      expect(sumMoney(r.salesByOwner.rows.map((row: { wonValue: string }) => row.wonValue))).toBe(r.salesByOwner.totals.wonValue);
      expect(r.salesByOwner.totals.wonCount).toBeGreaterThan(0);

      // Quotations: rows add up, and each status count equals the Quotations
      // list's own expiry-aware Status filter for the same issue-date range.
      expect(r.quotations.rows.reduce((n: number, row: { count: number }) => n + row.count, 0)).toBe(r.quotations.totals.count);
      expect(sumMoney(r.quotations.rows.map((row: { value: string }) => row.value))).toBe(r.quotations.totals.value);
      const ownerFilter = scope === 'mine' ? `&ownerId=${role === 'admin' ? tenant.adminUser.id : tenant.staffUser.id}` : '';
      for (const row of r.quotations.rows as { status: string; count: number }[]) {
        const list = await api.get(`/api/v1/quotations?status=${row.status}&issuedFrom=${W.from}&issuedTo=${W.to}${ownerFilter}`);
        expect(list.body.meta.total, `quotations with status ${row.status}`).toBe(row.count);
      }

      // Overdue: rows add up to the total.
      expect(r.overdueTasks.rows.reduce((n: number, row: { count: number }) => n + row.count, 0)).toBe(r.overdueTasks.totals.count);
    });
  }

  it('Overdue tasks over an all-time range equals Home\'s "Overdue tasks" figure, in both scopes', async () => {
    const tenant = await createTestTenant();
    await seedMixed(tenant);
    for (const scope of ['all', 'mine'] as const) {
      const { r, d } = await both(tenant, 'staff', `from=2000-01-01&to=${todayKeyIst()}&scope=${scope}`);
      expect(r.overdueTasks.totals.count).toBe(d.metrics.overdueActivities);
      expect(r.overdueTasks.totals.count).toBeGreaterThan(0);
    }
  });

  it('with no range given, both default to the same current month and still agree', async () => {
    const tenant = await createTestTenant();
    await seedMixed(tenant);
    const { r, d } = await both(tenant, 'admin', 'scope=all');
    expect(r.range).toEqual(d.range);
    expect(r.leadSources.totals.created).toBe(d.metrics.leadsCreated);
    expect(r.salesByOwner.totals.wonValue).toBe(d.metrics.wonRevenue);
    expect(r.salesByOwner.totals.wonCount).toBe(d.metrics.wonDeals);
  });
});
