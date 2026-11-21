import type { DashboardQuery, TodayQuery } from '@growspark/shared';
import { prisma } from '../../db/prisma.js';
import { Prisma } from '../../generated/prisma/client.js';
import type { ActivityType } from '../../generated/prisma/client.js';
import { ApiError } from '../../middleware/error-handler.js';
import { scoped } from '../../lib/scoped.js';
import { orgDayBounds, orgDateBounds, orgDateKey, orgMonthBounds, addOrgDays } from '../../lib/org-time.js';
import { getPipelineSummary } from '../pipeline/pipeline.service.js';
import type { RequestContext } from '../../lib/context.js';

type CountRow = { count: number };
type NumberRow = { value: string | number };
type OpenDealsRow = { count: number; value: string | number; weighted: string | number };

async function countLeads(ctx: RequestContext, from: Date, to: Date, ownerId?: string): Promise<number> {
  const [row] = await prisma.$queryRaw<CountRow[]>`
    SELECT COUNT(*)::int AS count FROM leads
    WHERE organization_id = ${ctx.orgId}::uuid AND archived_at IS NULL
      AND created_at >= ${from} AND created_at < ${to}
      ${ownerId ? Prisma.sql`AND owner_id = ${ownerId}::uuid` : Prisma.empty}
  `;
  return row?.count ?? 0;
}

async function countCurrentLeads(ctx: RequestContext, status: 'NEW' | 'QUALIFIED', ownerId?: string): Promise<number> {
  const [row] = await prisma.$queryRaw<CountRow[]>`
    SELECT COUNT(*)::int AS count FROM leads
    WHERE organization_id = ${ctx.orgId}::uuid AND archived_at IS NULL AND status = ${status}::lead_status
      ${ownerId ? Prisma.sql`AND owner_id = ${ownerId}::uuid` : Prisma.empty}
  `;
  return row?.count ?? 0;
}

async function countActiveLeads(ctx: RequestContext, ownerId?: string): Promise<number> {
  const [row] = await prisma.$queryRaw<CountRow[]>`
    SELECT COUNT(*)::int AS count FROM leads
    WHERE organization_id = ${ctx.orgId}::uuid AND archived_at IS NULL
      AND status IN ('NEW'::lead_status, 'CONTACTED'::lead_status, 'QUALIFIED'::lead_status)
      ${ownerId ? Prisma.sql`AND owner_id = ${ownerId}::uuid` : Prisma.empty}
  `;
  return row?.count ?? 0;
}

async function cohortConversionRate(ctx: RequestContext, from: Date, to: Date, ownerId?: string): Promise<string> {
  const [row] = await prisma.$queryRaw<NumberRow[]>`
    SELECT COALESCE(100.0 * COUNT(*) FILTER (WHERE status = 'CONVERTED'::lead_status) / NULLIF(COUNT(*), 0), 0)::numeric(7,2)::text AS value
    FROM leads WHERE organization_id = ${ctx.orgId}::uuid AND archived_at IS NULL
      AND created_at >= ${from} AND created_at < ${to}
      ${ownerId ? Prisma.sql`AND owner_id = ${ownerId}::uuid` : Prisma.empty}
  `;
  return String(row?.value ?? 0);
}

async function openDealsSnapshot(ctx: RequestContext, ownerId?: string): Promise<OpenDealsRow> {
  const [row] = await prisma.$queryRaw<OpenDealsRow[]>`
    SELECT COUNT(*)::int AS count, COALESCE(SUM(value),0)::numeric(14,2)::text AS value,
      COALESCE(SUM(value * probability / 100.0),0)::numeric(14,2)::text AS weighted
    FROM deals WHERE organization_id = ${ctx.orgId}::uuid AND status = 'OPEN'::deal_status AND archived_at IS NULL
      ${ownerId ? Prisma.sql`AND owner_id = ${ownerId}::uuid` : Prisma.empty}
  `;
  return row ?? { count: 0, value: '0.00', weighted: '0.00' };
}

async function closedDealCounts(ctx: RequestContext, from: Date, to: Date, ownerId?: string): Promise<{ won: number; lost: number }> {
  const [row] = await prisma.$queryRaw<{ won: number; lost: number }[]>`
    SELECT COUNT(*) FILTER (WHERE status = 'WON'::deal_status)::int AS won,
      COUNT(*) FILTER (WHERE status = 'LOST'::deal_status)::int AS lost
    FROM deals WHERE organization_id = ${ctx.orgId}::uuid AND archived_at IS NULL AND closed_at >= ${from} AND closed_at < ${to}
      AND status IN ('WON'::deal_status,'LOST'::deal_status)
      ${ownerId ? Prisma.sql`AND owner_id = ${ownerId}::uuid` : Prisma.empty}
  `;
  return row ?? { won: 0, lost: 0 };
}

async function wonRevenue(ctx: RequestContext, from: Date, to: Date, ownerId?: string): Promise<string> {
  const [row] = await prisma.$queryRaw<NumberRow[]>`
    SELECT COALESCE(SUM(value),0)::numeric(14,2)::text AS value FROM deals
    WHERE organization_id = ${ctx.orgId}::uuid AND archived_at IS NULL AND status = 'WON'::deal_status
      AND closed_at >= ${from} AND closed_at < ${to}
      ${ownerId ? Prisma.sql`AND owner_id = ${ownerId}::uuid` : Prisma.empty}
  `;
  return String(row?.value ?? '0.00');
}

async function winRate(ctx: RequestContext, from: Date, to: Date, ownerId?: string): Promise<string> {
  const [row] = await prisma.$queryRaw<NumberRow[]>`
    SELECT COALESCE(100.0 * COUNT(*) FILTER (WHERE status = 'WON'::deal_status) / NULLIF(COUNT(*),0),0)::numeric(7,2)::text AS value
    FROM deals WHERE organization_id = ${ctx.orgId}::uuid AND archived_at IS NULL
      AND status IN ('WON'::deal_status,'LOST'::deal_status) AND closed_at >= ${from} AND closed_at < ${to}
      ${ownerId ? Prisma.sql`AND owner_id = ${ownerId}::uuid` : Prisma.empty}
  `;
  return String(row?.value ?? '0.00');
}

async function overdueActivities(ctx: RequestContext, start: Date, ownerId?: string): Promise<number> {
  const [row] = await prisma.$queryRaw<CountRow[]>`
    SELECT COUNT(*)::int AS count FROM activities WHERE organization_id = ${ctx.orgId}::uuid
      AND status = 'OPEN'::activity_status AND type IN ('TASK'::activity_type,'CALL'::activity_type,'MEETING'::activity_type)
      AND due_at < ${start} ${ownerId ? Prisma.sql`AND assignee_id = ${ownerId}::uuid` : Prisma.empty}
  `;
  return row?.count ?? 0;
}

async function leadsBySource(ctx: RequestContext, ownerId?: string) {
  return prisma.$queryRaw<{ sourceId: string; sourceName: string; count: number }[]>`
    SELECT l.source_id AS "sourceId", s.name AS "sourceName", COUNT(*)::int AS count
    FROM leads l JOIN lead_sources s ON s.id = l.source_id AND s.organization_id = l.organization_id
    WHERE l.organization_id = ${ctx.orgId}::uuid AND l.archived_at IS NULL
      ${ownerId ? Prisma.sql`AND l.owner_id = ${ownerId}::uuid` : Prisma.empty}
    GROUP BY l.source_id,s.name ORDER BY count DESC,s.name
  `;
}

async function leadsByStatus(ctx: RequestContext, ownerId?: string) {
  return prisma.$queryRaw<{ status: string; count: number }[]>`
    SELECT status::text AS status, COUNT(*)::int AS count FROM leads
    WHERE organization_id = ${ctx.orgId}::uuid AND archived_at IS NULL
      ${ownerId ? Prisma.sql`AND owner_id = ${ownerId}::uuid` : Prisma.empty}
    GROUP BY status ORDER BY status
  `;
}

async function monthlyRevenue(ctx: RequestContext, now: Date, timeZone: string, ownerId?: string) {
  const months = Array.from({ length: 6 }, (_, offset) => {
    const anchor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (5 - offset), 15, 12));
    const bounds = orgMonthBounds(anchor, timeZone);
    return { month: orgDateKey(bounds.start, timeZone).slice(0, 7), ...bounds };
  });
  return Promise.all(months.map(async ({ month, start, end }) => ({
    month,
    value: await wonRevenue(ctx, start, end, ownerId),
  })));
}

export async function getDashboard(ctx: RequestContext, query: DashboardQuery, now = new Date()) {
  const organization = await prisma.organization.findUnique({ where: { id: ctx.orgId }, select: { timezone: true } });
  if (!organization) throw new ApiError(404, 'NOT_FOUND', 'Organisation not found');
  const timeZone = organization.timezone;
  const currentMonth = orgMonthBounds(now, timeZone);
  const fromDate = query.from ?? query.to;
  const toDate = query.to ?? query.from;
  const from = fromDate ? orgDateBounds(fromDate, timeZone).start : currentMonth.start;
  const to = toDate ? orgDateBounds(toDate, timeZone).end : currentMonth.end;
  const ownerId = query.scope === 'mine' ? ctx.userId : undefined;
  const [created, newLeads, qualified, active, conversion, open, closed, revenue, rate, overdue,
    sourceRows, statusRows, pipelineByStage, monthlyWonRevenue, recentActivity] = await Promise.all([
    countLeads(ctx, from, to, ownerId), countCurrentLeads(ctx, 'NEW', ownerId), countCurrentLeads(ctx, 'QUALIFIED', ownerId),
    countActiveLeads(ctx, ownerId), cohortConversionRate(ctx, from, to, ownerId), openDealsSnapshot(ctx, ownerId),
    closedDealCounts(ctx, from, to, ownerId), wonRevenue(ctx, from, to, ownerId), winRate(ctx, from, to, ownerId),
    overdueActivities(ctx, orgDayBounds(now, timeZone).start, ownerId), leadsBySource(ctx, ownerId), leadsByStatus(ctx, ownerId),
    getPipelineSummary(ctx, ownerId), monthlyRevenue(ctx, now, timeZone, ownerId),
    prisma.activity.findMany({ where: { ...scoped(ctx), ...(ownerId ? { assigneeId: ownerId } : {}) }, orderBy: { createdAt: 'desc' }, take: 10 }),
  ]);
  return { data: {
    range: { from: orgDateKey(from, timeZone), to: orgDateKey(new Date(to.getTime() - 1), timeZone) }, scope: query.scope,
    metrics: { leadsCreated: created, newLeads, qualifiedLeads: qualified, activeLeads: active,
      leadConversionRate: conversion, openDeals: { count: open.count, value: String(open.value), weightedValue: String(open.weighted) },
      wonDeals: closed.won, lostDeals: closed.lost, wonRevenue: revenue, winRate: rate, overdueActivities: overdue },
    leadsBySource: sourceRows, leadsByStatus: statusRows,
    pipelineByStage, monthlyWonRevenue,
    recentActivity: recentActivity.map((item) => ({
      id: item.id, type: item.type, subject: item.subject, description: item.description, status: item.status,
      priority: item.priority, dueAt: item.dueAt?.toISOString() ?? null, startAt: item.startAt?.toISOString() ?? null,
      endAt: item.endAt?.toISOString() ?? null, reminderAt: item.reminderAt?.toISOString() ?? null,
      completedAt: item.completedAt?.toISOString() ?? null, assigneeId: item.assigneeId, createdById: item.createdById,
      leadId: item.leadId, contactId: item.contactId, companyId: item.companyId, dealId: item.dealId,
      createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString(),
    })),
  } };
}

export async function getToday(ctx: RequestContext, query: TodayQuery, now = new Date()) {
  const organization = await prisma.organization.findUnique({ where: { id: ctx.orgId }, select: { timezone: true } });
  if (!organization) throw new ApiError(404, 'NOT_FOUND', 'Organisation not found');
  const timeZone = organization.timezone;
  const today = orgDayBounds(now, timeZone);
  const meetingsEnd = addOrgDays(today.start, 8, timeZone);
  const closeBy = new Date(`${orgDateKey(addOrgDays(now, 14, timeZone), timeZone)}T00:00:00.000Z`);
  const ownerId = query.scope === 'mine' ? ctx.userId : undefined;
  const activityScope = ownerId ? { assigneeId: ownerId } : {};
  const dealScope = ownerId ? { ownerId } : {};
  const leadScope = ownerId ? { ownerId } : {};

  const dueToday = { ...scoped(ctx), status: 'OPEN' as const, type: 'TASK' as const, dueAt: { gte: today.start, lt: today.end }, ...activityScope };
  const overdue = { ...scoped(ctx), status: 'OPEN' as const, type: 'TASK' as const, dueAt: { lt: today.start }, ...activityScope };
  const meetings = { ...scoped(ctx), status: 'OPEN' as const, type: 'MEETING' as const, startAt: { gte: today.start, lt: meetingsEnd }, ...activityScope };
  const newLeadWhere = { ...scoped(ctx), status: 'NEW' as const, archivedAt: null, ...leadScope };
  const openDealWhere = { ...scoped(ctx), status: 'OPEN' as const, archivedAt: null, ...dealScope };
  const closingWhere = { ...openDealWhere, expectedCloseDate: { lte: closeBy } };
  const noActivityWhere: Prisma.DealWhereInput = { ...openDealWhere, activities: { none: { status: 'OPEN', type: { in: ['TASK', 'CALL', 'MEETING'] as ActivityType[] } } } };
  const recentlyWhere = { ...scoped(ctx), archivedAt: null, ...dealScope, updatedAt: { gte: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000) } };

  const [dueRows, dueCount, overdueRows, overdueCount, meetingRows, meetingCount,
    leadRows, leadCount, closingRows, closingCount, noActivityRows, noActivityCount, recentRows, recentCount] = await Promise.all([
    prisma.activity.findMany({ where: dueToday, orderBy: { dueAt: 'asc' }, take: 10 }), prisma.activity.count({ where: dueToday }),
    prisma.activity.findMany({ where: overdue, orderBy: { dueAt: 'asc' }, take: 10 }), prisma.activity.count({ where: overdue }),
    prisma.activity.findMany({ where: meetings, orderBy: { startAt: 'asc' }, take: 10 }), prisma.activity.count({ where: meetings }),
    prisma.lead.findMany({ where: newLeadWhere, orderBy: { createdAt: 'desc' }, take: 10 }), prisma.lead.count({ where: newLeadWhere }),
    prisma.deal.findMany({ where: closingWhere, orderBy: { expectedCloseDate: 'asc' }, take: 10 }), prisma.deal.count({ where: closingWhere }),
    prisma.deal.findMany({ where: noActivityWhere, orderBy: { updatedAt: 'desc' }, take: 10 }), prisma.deal.count({ where: noActivityWhere }),
    prisma.deal.findMany({ where: recentlyWhere, orderBy: { updatedAt: 'desc' }, take: 10 }), prisma.deal.count({ where: recentlyWhere }),
  ]);

  const activityItems = (rows: typeof dueRows, href: string) => rows.map((row) => ({ id: row.id, title: row.subject, href, type: row.type, dueAt: row.dueAt?.toISOString() ?? null }));
  const dealItems = (rows: typeof closingRows, href: string) => rows.map((row) => ({ id: row.id, title: row.name, href, type: 'DEAL' }));
  const leadItems = leadRows.map((row) => ({ id: row.id, title: [row.firstName, row.lastName].filter(Boolean).join(' '), href: '/leads?status=NEW', type: 'LEAD' }));
  const scopeParam = ownerId ? `&${'ownerId'}=${ownerId}` : '';
  const activityScopeParam = ownerId ? `&assigneeId=${ownerId}` : '';
  return { data: {
    tasksDueToday: { items: activityItems(dueRows, `/activities?type=TASK&status=OPEN${activityScopeParam}`), total: dueCount },
    overdueTasks: { items: activityItems(overdueRows, `/activities?type=TASK&status=OPEN${activityScopeParam}`), total: overdueCount },
    meetings: { items: activityItems(meetingRows, `/activities?type=MEETING&status=OPEN${activityScopeParam}`), total: meetingCount },
    newLeads: { items: leadItems, total: leadCount },
    closingDeals: { items: dealItems(closingRows, `/deals?status=OPEN${scopeParam}`), total: closingCount },
    dealsWithoutActivity: { items: dealItems(noActivityRows, `/deals?status=OPEN${scopeParam}`), total: noActivityCount },
    recentlyUpdatedDeals: { items: dealItems(recentRows, `/deals?status=OPEN${scopeParam}`), total: recentCount },
  } };
}
