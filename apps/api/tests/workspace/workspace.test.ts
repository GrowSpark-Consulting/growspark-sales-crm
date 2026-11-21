import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { Prisma } from '../../src/generated/prisma/client.js';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';
import { orgDateBounds, orgDateKey, orgDayBounds, orgMonthBounds } from '../../src/lib/org-time.js';
import { createTestTenant } from '../helpers/tenant.js';
import { createSession } from '../../src/lib/session.js';
import { sessionCookieHeader } from '../helpers/http.js';

function get(token: string, path: string) {
  return request(createApp()).get(path).set('Cookie', sessionCookieHeader(token));
}

function canonicalDecimal(value: string): string {
  return value.replace(/(\.\d*?[1-9])0+$|\.0+$/, '$1');
}

async function independentDashboardSql(orgId: string, from: Date, to: Date, dayStart: Date, ownerId?: string) {
  const leadOwner = ownerId ? Prisma.sql`AND owner_id = ${ownerId}::uuid` : Prisma.empty;
  const dealOwner = ownerId ? Prisma.sql`AND owner_id = ${ownerId}::uuid` : Prisma.empty;
  const activityOwner = ownerId ? Prisma.sql`AND assignee_id = ${ownerId}::uuid` : Prisma.empty;
  const [row] = await prisma.$queryRaw<Record<string, number | string>[]>`
    SELECT
      (SELECT COUNT(*)::int FROM leads WHERE organization_id=${orgId}::uuid AND archived_at IS NULL AND created_at >= ${from} AND created_at < ${to} ${leadOwner}) AS leads_created,
      (SELECT COUNT(*)::int FROM leads WHERE organization_id=${orgId}::uuid AND archived_at IS NULL AND status='NEW'::lead_status ${leadOwner}) AS new_leads,
      (SELECT COUNT(*)::int FROM leads WHERE organization_id=${orgId}::uuid AND archived_at IS NULL AND status='QUALIFIED'::lead_status ${leadOwner}) AS qualified_leads,
      (SELECT COUNT(*)::int FROM leads WHERE organization_id=${orgId}::uuid AND archived_at IS NULL AND status IN ('NEW'::lead_status,'CONTACTED'::lead_status,'QUALIFIED'::lead_status) ${leadOwner}) AS active_leads,
      (SELECT COALESCE(100.0 * COUNT(*) FILTER (WHERE status='CONVERTED'::lead_status) / NULLIF(COUNT(*),0),0)::numeric(7,2)::text FROM leads WHERE organization_id=${orgId}::uuid AND archived_at IS NULL AND created_at >= ${from} AND created_at < ${to} ${leadOwner}) AS conversion_rate,
      (SELECT COUNT(*)::int FROM deals WHERE organization_id=${orgId}::uuid AND archived_at IS NULL AND status='OPEN'::deal_status ${dealOwner}) AS open_count,
      (SELECT COALESCE(SUM(value),0)::numeric(14,2)::text FROM deals WHERE organization_id=${orgId}::uuid AND archived_at IS NULL AND status='OPEN'::deal_status ${dealOwner}) AS open_value,
      (SELECT COALESCE(SUM(value*probability/100.0),0)::numeric(14,2)::text FROM deals WHERE organization_id=${orgId}::uuid AND archived_at IS NULL AND status='OPEN'::deal_status ${dealOwner}) AS weighted_value,
      (SELECT COUNT(*)::int FROM deals WHERE organization_id=${orgId}::uuid AND archived_at IS NULL AND status='WON'::deal_status AND closed_at >= ${from} AND closed_at < ${to} ${dealOwner}) AS won_count,
      (SELECT COUNT(*)::int FROM deals WHERE organization_id=${orgId}::uuid AND archived_at IS NULL AND status='LOST'::deal_status AND closed_at >= ${from} AND closed_at < ${to} ${dealOwner}) AS lost_count,
      (SELECT COALESCE(SUM(value),0)::numeric(14,2)::text FROM deals WHERE organization_id=${orgId}::uuid AND archived_at IS NULL AND status='WON'::deal_status AND closed_at >= ${from} AND closed_at < ${to} ${dealOwner}) AS won_revenue,
      (SELECT COALESCE(100.0 * COUNT(*) FILTER (WHERE status='WON'::deal_status) / NULLIF(COUNT(*),0),0)::numeric(7,2)::text FROM deals WHERE organization_id=${orgId}::uuid AND archived_at IS NULL AND status IN ('WON'::deal_status,'LOST'::deal_status) AND closed_at >= ${from} AND closed_at < ${to} ${dealOwner}) AS win_rate,
      (SELECT COUNT(*)::int FROM activities WHERE organization_id=${orgId}::uuid AND status='OPEN'::activity_status AND type IN ('TASK'::activity_type,'CALL'::activity_type,'MEETING'::activity_type) AND due_at < ${dayStart} ${activityOwner}) AS overdue_count
  `;
  return row!;
}

describe('Today and dashboard', () => {
  it('fills every Today section and keeps organisation data isolated', async () => {
    const tenant = await createTestTenant();
    const other = await createTestTenant('Other Org');
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const company = await prisma.company.create({ data: { organizationId: tenant.organization.id, name: 'Today Co', nameNormalized: 'today co' } });
    const bounds = orgDayBounds(new Date(), tenant.organization.timezone);
    const lead = await prisma.lead.create({ data: { organizationId: tenant.organization.id, firstName: 'Today Lead', email: 'today@example.test', emailNormalized: 'today@example.test', sourceId: tenant.leadSource.id, ownerId: tenant.adminUser.id } });
    await prisma.lead.create({ data: { organizationId: other.organization.id, firstName: 'Other Lead', email: 'other@example.test', emailNormalized: 'other@example.test', sourceId: other.leadSource.id } });
    await prisma.lead.create({ data: { organizationId: tenant.organization.id, firstName: 'Archived Today Lead', email: 'archived.today@example.test', emailNormalized: 'archived.today@example.test', sourceId: tenant.leadSource.id, archivedAt: new Date() } });
    const task = await prisma.activity.create({ data: { organizationId: tenant.organization.id, type: 'TASK', subject: 'Due today', status: 'OPEN', dueAt: new Date(bounds.start.getTime() + 60_000), assigneeId: tenant.adminUser.id, createdById: tenant.adminUser.id, leadId: lead.id } });
    const overdue = await prisma.activity.create({ data: { organizationId: tenant.organization.id, type: 'TASK', subject: 'Overdue', status: 'OPEN', dueAt: new Date(bounds.start.getTime() - 60_000), assigneeId: tenant.adminUser.id, createdById: tenant.adminUser.id, companyId: company.id } });
    const meeting = await prisma.activity.create({ data: { organizationId: tenant.organization.id, type: 'MEETING', subject: 'Upcoming meeting', status: 'OPEN', startAt: new Date(bounds.end.getTime() + 60_000), assigneeId: tenant.adminUser.id, createdById: tenant.adminUser.id, companyId: company.id } });
    const openDeal = await prisma.deal.create({ data: { organizationId: tenant.organization.id, name: 'Closing soon', companyId: company.id, pipelineId: tenant.pipeline.id, stageId: tenant.stages[0]!.id, probability: 10, ownerId: tenant.adminUser.id, expectedCloseDate: new Date(`${orgDateKey(new Date(), tenant.organization.timezone)}T00:00:00.000Z`) } });
    const wonDeal = await prisma.deal.create({ data: { organizationId: tenant.organization.id, name: 'Recently won', companyId: company.id, pipelineId: tenant.pipeline.id, stageId: tenant.stages.find((stage) => stage.type === 'WON')!.id, status: 'WON', probability: 100, ownerId: tenant.adminUser.id, closedAt: new Date() } });
    const lostDeal = await prisma.deal.create({ data: { organizationId: tenant.organization.id, name: 'Recently lost', companyId: company.id, pipelineId: tenant.pipeline.id, stageId: tenant.stages.find((stage) => stage.type === 'LOST')!.id, status: 'LOST', probability: 0, lostReason: 'Price', ownerId: tenant.adminUser.id, closedAt: new Date() } });
    const archivedDeal = await prisma.deal.create({ data: { organizationId: tenant.organization.id, name: 'Archived closing deal', companyId: company.id, pipelineId: tenant.pipeline.id, stageId: tenant.stages[0]!.id, probability: 10, ownerId: tenant.adminUser.id, archivedAt: new Date(), expectedCloseDate: new Date(`${orgDateKey(new Date(), tenant.organization.timezone)}T00:00:00.000Z`) } });
    await prisma.deal.create({ data: { organizationId: other.organization.id, name: 'Other deal', companyId: (await prisma.company.create({ data: { organizationId: other.organization.id, name: 'Other Co', nameNormalized: 'other co' } })).id, pipelineId: other.pipeline.id, stageId: other.stages[0]!.id, probability: 10, ownerId: other.adminUser.id } });

    const response = await get(token, '/api/v1/today?scope=all');
    expect(response.status).toBe(200);
    const sections = response.body.data;
    expect(sections.tasksDueToday.items.map((item: { id: string }) => item.id)).toContain(task.id);
    expect(sections.overdueTasks.items.map((item: { id: string }) => item.id)).toContain(overdue.id);
    expect(sections.meetings.items.map((item: { id: string }) => item.id)).toContain(meeting.id);
    expect(sections.newLeads.items.map((item: { id: string }) => item.id)).toContain(lead.id);
    expect(sections.closingDeals.items.map((item: { id: string }) => item.id)).toContain(openDeal.id);
    expect(sections.dealsWithoutActivity.items.map((item: { id: string }) => item.id)).toContain(openDeal.id);
    expect(sections.recentlyUpdatedDeals.items.map((item: { id: string }) => item.id)).toContain(openDeal.id);
    expect(sections.recentlyUpdatedDeals.items.map((item: { id: string }) => item.id)).toEqual(expect.arrayContaining([wonDeal.id, lostDeal.id]));
    for (const section of [sections.closingDeals, sections.dealsWithoutActivity, sections.recentlyUpdatedDeals]) {
      expect(section.items.map((item: { id: string }) => item.id)).not.toContain(archivedDeal.id);
    }
    expect(sections.newLeads.items.map((item: { title: string }) => item.title)).not.toContain('Other Lead');
    expect(sections.closingDeals.total).toBe(1);
    expect(sections.newLeads.total).toBe(1);
    expect(sections.tasksDueToday.items[0].href).toBe('/activities?type=TASK&status=OPEN');
    expect(sections.overdueTasks.items[0].href).toBe('/activities?type=TASK&status=OPEN');
    expect(sections.meetings.items[0].href).toBe('/activities?type=MEETING&status=OPEN');
    expect(sections.newLeads.items[0].href).toBe('/leads?status=NEW');
    expect(sections.closingDeals.items[0].href).toBe('/deals?status=OPEN');
    expect(sections.dealsWithoutActivity.items[0].href).toBe('/deals?status=OPEN');
    expect(sections.recentlyUpdatedDeals.items.every((item: { href: string }) => item.href === '/deals')).toBe(true);
    const mine = await get(token, '/api/v1/today?scope=mine');
    expect(mine.body.data.newLeads.items[0].href).toBe(`/leads?status=NEW&ownerId=${tenant.adminUser.id}`);
  });

  it('matches every dashboard KPI to independent SQL for all/mine and handles empty ranges and organisations', async () => {
    const tenant = await createTestTenant();
    const other = await createTestTenant('Other Org');
    const empty = await createTestTenant('Empty Org');
    const [admin, staff] = await Promise.all([
      createSession(tenant.organization.id, tenant.adminUser.id), createSession(tenant.organization.id, tenant.staffUser.id),
    ]);
    const company = await prisma.company.create({ data: { organizationId: tenant.organization.id, name: 'Dashboard Co', nameNormalized: 'dashboard co' } });
    const selected = orgDateBounds('2026-11-21', tenant.organization.timezone);
    const createdAt = new Date('2026-11-21T04:00:00.000Z');
    const lead = async (n: number, status: 'NEW' | 'QUALIFIED' | 'CONVERTED', ownerId: string) => prisma.lead.create({ data: {
      organizationId: tenant.organization.id, firstName: `Dash ${n}`, email: `dash${n}@example.test`, emailNormalized: `dash${n}@example.test`,
      sourceId: tenant.leadSource.id, ownerId, status, convertedAt: status === 'CONVERTED' ? createdAt : null, createdAt,
    } });
    await lead(1, 'NEW', tenant.adminUser.id);
    await lead(2, 'QUALIFIED', tenant.adminUser.id);
    await lead(3, 'CONVERTED', tenant.staffUser.id);
    await prisma.lead.create({ data: { organizationId: tenant.organization.id, firstName: 'Archived', email: 'archived.dash@example.test', emailNormalized: 'archived.dash@example.test', sourceId: tenant.leadSource.id, status: 'QUALIFIED', ownerId: tenant.adminUser.id, createdAt, archivedAt: createdAt } });
    await prisma.lead.create({ data: { organizationId: other.organization.id, firstName: 'Leak test', email: 'leak@example.test', emailNormalized: 'leak@example.test', sourceId: other.leadSource.id } });
    await prisma.deal.create({ data: { organizationId: tenant.organization.id, name: 'Dashboard Won', companyId: company.id, pipelineId: tenant.pipeline.id, stageId: tenant.stages.find((s) => s.type === 'WON')!.id, status: 'WON', value: '120.35', probability: 100, closedAt: createdAt, ownerId: tenant.adminUser.id } });
    await prisma.deal.create({ data: { organizationId: tenant.organization.id, name: 'Dashboard Lost', companyId: company.id, pipelineId: tenant.pipeline.id, stageId: tenant.stages.find((s) => s.type === 'LOST')!.id, status: 'LOST', lostReason: 'Price', value: '50.10', probability: 0, closedAt: createdAt, ownerId: tenant.staffUser.id } });
    const open = await prisma.deal.create({ data: { organizationId: tenant.organization.id, name: 'Dashboard Open', companyId: company.id, pipelineId: tenant.pipeline.id, stageId: tenant.stages[0]!.id, status: 'OPEN', value: '1000.25', probability: 25, ownerId: tenant.adminUser.id } });
    await prisma.deal.create({ data: { organizationId: tenant.organization.id, name: 'Archived dashboard open', companyId: company.id, pipelineId: tenant.pipeline.id, stageId: tenant.stages[0]!.id, status: 'OPEN', value: '5000.00', probability: 50, ownerId: tenant.adminUser.id, archivedAt: createdAt } });
    const dayBounds = orgDayBounds(new Date(), tenant.organization.timezone);
    await prisma.activity.create({ data: { organizationId: tenant.organization.id, type: 'TASK', subject: 'Dashboard overdue', status: 'OPEN', dueAt: new Date(dayBounds.start.getTime() - 1), assigneeId: tenant.adminUser.id, createdById: tenant.adminUser.id, dealId: open.id, companyId: company.id } });

    for (const scope of ['all', 'mine'] as const) {
      const url = `/api/v1/dashboard?from=2026-11-21&to=2026-11-21&scope=${scope}`;
      const response = await get(admin.token, url);
      expect(response.status).toBe(200);
      const ownerId = scope === 'mine' ? tenant.adminUser.id : undefined;
      const sql = await independentDashboardSql(tenant.organization.id, selected.start, selected.end, dayBounds.start, ownerId);
      const metrics = response.body.data.metrics;
      expect(metrics.leadsCreated).toBe(sql.leads_created);
      expect(metrics.newLeads).toBe(sql.new_leads);
      expect(metrics.qualifiedLeads).toBe(sql.qualified_leads);
      expect(metrics.activeLeads).toBe(sql.active_leads);
      expect(metrics.leadConversionRate).toBe(sql.conversion_rate);
      expect(metrics.openDeals.count).toBe(sql.open_count);
      expect(metrics.openDeals.value).toBe(sql.open_value);
      expect(metrics.openDeals.weightedValue).toBe(sql.weighted_value);
      expect(metrics.wonDeals).toBe(sql.won_count);
      expect(metrics.lostDeals).toBe(sql.lost_count);
      expect(metrics.wonRevenue).toBe(sql.won_revenue);
      expect(metrics.winRate).toBe(sql.win_rate);
      expect(metrics.overdueActivities).toBe(sql.overdue_count);
      const statusOwner = ownerId ? Prisma.sql`AND owner_id = ${ownerId}::uuid` : Prisma.empty;
      const statusSql = await prisma.$queryRaw<{ status: string; count: number }[]>`
        SELECT status::text AS status, COUNT(*)::int AS count FROM leads
        WHERE organization_id=${tenant.organization.id}::uuid AND archived_at IS NULL ${statusOwner}
        GROUP BY status ORDER BY status
      `;
      expect(response.body.data.leadsByStatus).toEqual(statusSql);
      expect(response.body.data.monthlyWonRevenue).toHaveLength(6);
      const firstMonth = response.body.data.monthlyWonRevenue[0].month as string;
      const lastMonth = response.body.data.monthlyWonRevenue[5].month as string;
      const monthlyStart = orgDateBounds(`${firstMonth}-01`, tenant.organization.timezone).start;
      const monthlyEnd = orgMonthBounds(new Date(`${lastMonth}-15T12:00:00.000Z`), tenant.organization.timezone).end;
      const monthlyOwner = ownerId ? Prisma.sql`AND owner_id = ${ownerId}::uuid` : Prisma.empty;
      const monthSql = await prisma.$queryRaw<{ month: string; value: string }[]>`
        SELECT to_char(date_trunc('month', closed_at AT TIME ZONE ${tenant.organization.timezone}), 'YYYY-MM') AS month,
          COALESCE(SUM(value),0)::numeric(14,2)::text AS value FROM deals
        WHERE organization_id = ${tenant.organization.id}::uuid AND archived_at IS NULL AND status='WON'::deal_status
          AND closed_at >= ${monthlyStart} AND closed_at < ${monthlyEnd} ${monthlyOwner}
        GROUP BY 1 ORDER BY 1
      `;
      const expectedMonths = response.body.data.monthlyWonRevenue.map((row: { month: string }) => ({ month: row.month, value: '0.00' }));
      for (const row of monthSql) {
        const index = expectedMonths.findIndex((month: { month: string }) => month.month === row.month);
        if (index >= 0) expectedMonths[index] = row;
      }
      expect(response.body.data.monthlyWonRevenue).toEqual(expectedMonths);
      const sourceOwner = ownerId ? Prisma.sql`AND l.owner_id = ${ownerId}::uuid` : Prisma.empty;
      const sourceSql = await prisma.$queryRaw<{ sourceId: string; sourceName: string; count: number }[]>`
        SELECT l.source_id AS "sourceId", s.name AS "sourceName", COUNT(*)::int AS count FROM leads l
        JOIN lead_sources s ON s.id=l.source_id AND s.organization_id=l.organization_id
        WHERE l.organization_id=${tenant.organization.id}::uuid AND l.archived_at IS NULL ${sourceOwner}
        GROUP BY l.source_id,s.name ORDER BY count DESC,s.name
      `;
      expect(response.body.data.leadsBySource).toEqual(sourceSql);
      const pipelineOwner = ownerId ? Prisma.sql`AND d.owner_id = ${ownerId}::uuid` : Prisma.empty;
      const pipelineSql = await prisma.$queryRaw<{ stageId: string; count: number; totalValue: string; weightedValue: string }[]>`
        SELECT ps.id AS "stageId", COUNT(d.id)::int AS count,
          COALESCE(SUM(d.value),0)::numeric(14,2)::text AS "totalValue",
          COALESCE(SUM(d.value*d.probability/100.0),0)::numeric(14,2)::text AS "weightedValue"
        FROM pipeline_stages ps LEFT JOIN deals d ON d.stage_id=ps.id AND d.organization_id=ps.organization_id AND d.archived_at IS NULL ${pipelineOwner}
        WHERE ps.organization_id=${tenant.organization.id}::uuid AND ps.pipeline_id=${tenant.pipeline.id}::uuid
        GROUP BY ps.id,ps.position ORDER BY ps.position
      `;
      expect(response.body.data.pipelineByStage.stages.map((row: { stageId: string; count: number; totalValue: string; weightedValue: string }) => ({ stageId: row.stageId, count: row.count, totalValue: row.totalValue, weightedValue: row.weightedValue }))).toEqual(pipelineSql.map((row) => ({ ...row, totalValue: canonicalDecimal(row.totalValue), weightedValue: canonicalDecimal(row.weightedValue) })));
      const activityOwner = ownerId ? Prisma.sql`AND assignee_id=${ownerId}::uuid` : Prisma.empty;
      const recentSql = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM activities WHERE organization_id=${tenant.organization.id}::uuid ${activityOwner}
        ORDER BY created_at DESC LIMIT 10
      `;
      expect(response.body.data.recentActivity.map((row: { id: string }) => row.id)).toEqual(recentSql.map((row) => row.id));
    }
    const staffDashboard = await get(staff.token, '/api/v1/dashboard?scope=all');
    expect(staffDashboard.status).toBe(200);
    const emptyRange = await get(admin.token, '/api/v1/dashboard?from=2026-10-01&to=2026-10-01&scope=all');
    expect(emptyRange.status).toBe(200);
    expect(emptyRange.body.data.metrics.leadsCreated).toBe(0);
    expect(emptyRange.body.data.metrics.wonRevenue).toBe('0.00');
    const emptyRangeBounds = orgDateBounds('2026-10-01', tenant.organization.timezone);
    const emptyRangeSql = await independentDashboardSql(tenant.organization.id, emptyRangeBounds.start, emptyRangeBounds.end, dayBounds.start);
    expect(emptyRange.body.data.metrics).toMatchObject({
      leadsCreated: emptyRangeSql.leads_created, newLeads: emptyRangeSql.new_leads,
      qualifiedLeads: emptyRangeSql.qualified_leads, activeLeads: emptyRangeSql.active_leads,
      leadConversionRate: emptyRangeSql.conversion_rate,
      openDeals: { count: emptyRangeSql.open_count, value: emptyRangeSql.open_value, weightedValue: emptyRangeSql.weighted_value },
      wonDeals: emptyRangeSql.won_count, lostDeals: emptyRangeSql.lost_count,
      wonRevenue: emptyRangeSql.won_revenue, winRate: emptyRangeSql.win_rate,
      overdueActivities: emptyRangeSql.overdue_count,
    });
    expect(emptyRange.body.data.leadsBySource.some((row: { sourceId: string }) => row.sourceId === other.leadSource.id)).toBe(false);
    const emptyOrg = await get((await createSession(empty.organization.id, empty.adminUser.id)).token, '/api/v1/dashboard?from=2026-10-01&to=2026-10-01');
    expect(emptyOrg.body.data.metrics.leadsCreated).toBe(0);
    expect(emptyOrg.body.data.metrics.openDeals.count).toBe(0);
    const emptyOrgBounds = orgDateBounds('2026-10-01', empty.organization.timezone);
    const emptyOrgDay = orgDayBounds(new Date(), empty.organization.timezone);
    const emptyOrgSql = await independentDashboardSql(empty.organization.id, emptyOrgBounds.start, emptyOrgBounds.end, emptyOrgDay.start);
    expect(emptyOrg.body.data.metrics).toMatchObject({
      leadsCreated: emptyOrgSql.leads_created, newLeads: emptyOrgSql.new_leads,
      qualifiedLeads: emptyOrgSql.qualified_leads, activeLeads: emptyOrgSql.active_leads,
      leadConversionRate: emptyOrgSql.conversion_rate,
      openDeals: { count: emptyOrgSql.open_count, value: emptyOrgSql.open_value, weightedValue: emptyOrgSql.weighted_value },
      wonDeals: emptyOrgSql.won_count, lostDeals: emptyOrgSql.lost_count,
      wonRevenue: emptyOrgSql.won_revenue, winRate: emptyOrgSql.win_rate,
      overdueActivities: emptyOrgSql.overdue_count,
    });
  });
});
