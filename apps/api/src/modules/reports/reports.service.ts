import { QUOTATION_STATUSES, type ReportKey, type ReportsData, type ReportsQuery } from '@growspark/shared';
import { prisma } from '../../db/prisma.js';
import { Prisma } from '../../generated/prisma/client.js';
import { scoped } from '../../lib/scoped.js';
import { orgDayBounds, orgDateKey } from '../../lib/org-time.js';
import type { CsvColumn } from '../../lib/csv.js';
import type { RequestContext } from '../../lib/context.js';
import { getPipelineSummary } from '../pipeline/pipeline.service.js';
import { quotationStatusWhere } from '../quotations/quotations.service.js';
import {
  closedDealCounts,
  cohortConversionRate,
  countLeads,
  resolveReportingRange,
  winRate,
  wonRevenue,
  type ReportingRange,
} from '../workspace/workspace.service.js';

/**
 * Predefined reports (Day 5c, feature 3 — D92). Read-only. Every figure is
 * computed in Postgres over NUMERIC columns (never JS floats), every query is
 * organisation-scoped, and "Mine" narrows by the same owner column Home uses
 * (lead/deal/quotation owner, activity assignee). Wherever a report overlaps
 * the Home dashboard, its totals come from the very same functions
 * (workspace.service.ts) — reconciled by tests/reports/reconciliation.test.ts.
 */

interface ReportContext {
  ctx: RequestContext;
  range: ReportingRange;
  ownerId: string | undefined;
  now: Date;
}

const ownerSql = (column: Prisma.Sql, ownerId: string | undefined) =>
  ownerId ? Prisma.sql`AND ${column} = ${ownerId}::uuid` : Prisma.empty;

/** Always two decimal places ("100.00"), exact: getPipelineSummary passes Postgres numerics through as "100". */
const money2 = (value: string) => new Prisma.Decimal(value).toFixed(2);

/** 1. Pipeline by stage: the current open snapshot (no date range), exactly Home's pipelineByStage restricted to open stages. */
async function pipelineByStage({ ctx, ownerId }: ReportContext): Promise<ReportsData['pipelineByStage']> {
  const summary = await getPipelineSummary(ctx, ownerId);
  return {
    stages: summary.stages
      .filter((stage) => stage.type === 'OPEN')
      .map(({ stageId, name, position, count, totalValue, weightedValue }) => ({
        stageId, name, position, count, totalValue: money2(totalValue), weightedValue: money2(weightedValue),
      })),
    totals: { count: summary.open.count, totalValue: money2(summary.open.totalValue), weightedValue: money2(summary.open.weightedValue) },
  };
}

/** 2. Lead sources and conversion: leads created in the range (archived excluded, as Home), and how many of those are now converted. */
async function leadSources({ ctx, range, ownerId }: ReportContext): Promise<ReportsData['leadSources']> {
  const [rows, created, conversionRate, converted] = await Promise.all([
    prisma.$queryRaw<{ sourceId: string; sourceName: string; created: number; converted: number; conversionRate: string }[]>`
      SELECT l.source_id AS "sourceId", s.name AS "sourceName", COUNT(*)::int AS created,
        COUNT(*) FILTER (WHERE l.status = 'CONVERTED'::lead_status)::int AS converted,
        COALESCE(100.0 * COUNT(*) FILTER (WHERE l.status = 'CONVERTED'::lead_status) / NULLIF(COUNT(*), 0), 0)::numeric(7,2)::text AS "conversionRate"
      FROM leads l JOIN lead_sources s ON s.id = l.source_id AND s.organization_id = l.organization_id
      WHERE l.organization_id = ${ctx.orgId}::uuid AND l.archived_at IS NULL
        AND l.created_at >= ${range.from} AND l.created_at < ${range.to}
        ${ownerSql(Prisma.sql`l.owner_id`, ownerId)}
      GROUP BY l.source_id, s.name ORDER BY created DESC, s.name
    `,
    countLeads(ctx, range.from, range.to, ownerId),
    cohortConversionRate(ctx, range.from, range.to, ownerId),
    prisma.lead.count({
      where: { ...scoped(ctx), archivedAt: null, status: 'CONVERTED', createdAt: { gte: range.from, lt: range.to }, ...(ownerId ? { ownerId } : {}) },
    }),
  ]);
  return { rows, totals: { created, converted, conversionRate } };
}

/** 3. Sales performance by owner: deals closed (closed_at) in the range — Won count and value, Lost count, win rate. */
async function salesByOwner({ ctx, range, ownerId }: ReportContext): Promise<ReportsData['salesByOwner']> {
  const [rows, closed, value, rate] = await Promise.all([
    prisma.$queryRaw<{ ownerId: string | null; ownerName: string | null; wonCount: number; wonValue: string; lostCount: number; winRate: string }[]>`
      SELECT d.owner_id AS "ownerId", u.name AS "ownerName",
        COUNT(*) FILTER (WHERE d.status = 'WON'::deal_status)::int AS "wonCount",
        COALESCE(SUM(d.value) FILTER (WHERE d.status = 'WON'::deal_status), 0)::numeric(14,2)::text AS "wonValue",
        COUNT(*) FILTER (WHERE d.status = 'LOST'::deal_status)::int AS "lostCount",
        COALESCE(100.0 * COUNT(*) FILTER (WHERE d.status = 'WON'::deal_status) / NULLIF(COUNT(*), 0), 0)::numeric(7,2)::text AS "winRate"
      FROM deals d LEFT JOIN users u ON u.id = d.owner_id AND u.organization_id = d.organization_id
      WHERE d.organization_id = ${ctx.orgId}::uuid AND d.archived_at IS NULL
        AND d.status IN ('WON'::deal_status, 'LOST'::deal_status)
        AND d.closed_at >= ${range.from} AND d.closed_at < ${range.to}
        ${ownerSql(Prisma.sql`d.owner_id`, ownerId)}
      GROUP BY d.owner_id, u.name
      ORDER BY COALESCE(SUM(d.value) FILTER (WHERE d.status = 'WON'::deal_status), 0) DESC, u.name NULLS LAST
    `,
    closedDealCounts(ctx, range.from, range.to, ownerId),
    wonRevenue(ctx, range.from, range.to, ownerId),
    winRate(ctx, range.from, range.to, ownerId),
  ]);
  return { rows, totals: { wonCount: closed.won, wonValue: value, lostCount: closed.lost, winRate: rate } };
}

/**
 * 4. Quotations summary: quotations issued in the range (issue date, an
 * organisation calendar date, inclusive), archived excluded, counted and
 * valued by **effective** status through quotationStatusWhere (D86), so a
 * lapsed SENT quotation counts as Expired even if nobody has opened it yet.
 * Read-only: it never runs the auto-expiry write.
 */
async function quotations({ ctx, range, ownerId, now }: ReportContext): Promise<ReportsData['quotations']> {
  const todayKey = orgDateKey(now, range.timeZone);
  const base: Prisma.QuotationWhereInput = {
    ...scoped(ctx),
    archivedAt: null,
    issueDate: { gte: new Date(`${range.fromKey}T00:00:00.000Z`), lte: new Date(`${range.toKey}T00:00:00.000Z`) },
    ...(ownerId ? { ownerId } : {}),
  };
  const aggregate = (where: Prisma.QuotationWhereInput) =>
    prisma.quotation.aggregate({ where, _count: { _all: true }, _sum: { total: true } });
  const [perStatus, all] = await Promise.all([
    Promise.all(QUOTATION_STATUSES.map((status) => aggregate({ ...base, AND: [quotationStatusWhere(status, todayKey)] }))),
    aggregate(base),
  ]);
  const money = (value: Prisma.Decimal | null) => (value ?? new Prisma.Decimal(0)).toFixed(2);
  return {
    rows: QUOTATION_STATUSES.map((status, index) => ({ status, count: perStatus[index]!._count._all, value: money(perStatus[index]!._sum.total) })),
    totals: { count: all._count._all, value: money(all._sum.total) },
  };
}

/**
 * 5. Overdue tasks by assignee: open tasks, calls and meetings whose due date
 * is before the start of the organisation's today — Home's "Overdue tasks"
 * definition, unchanged — and, as approved, additionally limited to a due
 * date inside the selected range.
 */
async function overdueTasks({ ctx, range, ownerId, now }: ReportContext): Promise<ReportsData['overdueTasks']> {
  const dayStart = orgDayBounds(now, range.timeZone).start;
  const rows = await prisma.$queryRaw<{ assigneeId: string | null; assigneeName: string | null; count: number; oldestDueAt: Date }[]>`
    SELECT a.assignee_id AS "assigneeId", u.name AS "assigneeName", COUNT(*)::int AS count, MIN(a.due_at) AS "oldestDueAt"
    FROM activities a LEFT JOIN users u ON u.id = a.assignee_id AND u.organization_id = a.organization_id
    WHERE a.organization_id = ${ctx.orgId}::uuid AND a.status = 'OPEN'::activity_status
      AND a.type IN ('TASK'::activity_type, 'CALL'::activity_type, 'MEETING'::activity_type)
      AND a.due_at < ${dayStart} AND a.due_at >= ${range.from} AND a.due_at < ${range.to}
      ${ownerSql(Prisma.sql`a.assignee_id`, ownerId)}
    GROUP BY a.assignee_id, u.name ORDER BY count DESC, u.name NULLS LAST
  `;
  return {
    rows: rows.map((row) => ({ ...row, oldestDueAt: row.oldestDueAt.toISOString() })),
    totals: { count: rows.reduce((sum, row) => sum + row.count, 0) },
  };
}

async function reportContext(ctx: RequestContext, query: ReportsQuery, now: Date): Promise<ReportContext> {
  const range = await resolveReportingRange(ctx, query, now);
  return { ctx, range, ownerId: query.scope === 'mine' ? ctx.userId : undefined, now };
}

export async function getReports(ctx: RequestContext, query: ReportsQuery, now = new Date()): Promise<ReportsData> {
  const context = await reportContext(ctx, query, now);
  const [pipeline, sources, sales, quotationSummary, overdue] = await Promise.all([
    pipelineByStage(context),
    leadSources(context),
    salesByOwner(context),
    quotations(context),
    overdueTasks(context),
  ]);
  return {
    range: { from: context.range.fromKey, to: context.range.toKey },
    scope: query.scope,
    pipelineByStage: pipeline,
    leadSources: sources,
    salesByOwner: sales,
    quotations: quotationSummary,
    overdueTasks: overdue,
  };
}

// ---------------------------------------------------------------------------
// CSV export: one file per report, rows plus a final "Total" row. Money and
// percentages are plain decimals (e.g. 125000.50) so a spreadsheet can sum
// them; no first header is ever the bare text "ID" (rowsToCsv guards this).
// ---------------------------------------------------------------------------

type Row = Record<string, string | number | null>;

export interface ReportCsv {
  filename: string;
  rows: Row[];
  columns: readonly CsvColumn<Row>[];
}

const UNASSIGNED = 'Unassigned';

function columns(...headers: [header: string, key: string][]): CsvColumn<Row>[] {
  return headers.map(([header, key]) => ({ header, value: (row: Row) => row[key] ?? null }));
}

export async function getReportCsv(ctx: RequestContext, report: ReportKey, query: ReportsQuery, now = new Date()): Promise<ReportCsv> {
  const context = await reportContext(ctx, query, now);
  const filename = `report-${report}-${context.range.fromKey}-to-${context.range.toKey}${query.scope === 'mine' ? '-mine' : ''}.csv`;
  switch (report) {
    case 'pipeline-by-stage': {
      const data = await pipelineByStage(context);
      return {
        filename,
        columns: columns(['Stage', 'stage'], ['Open deals', 'count'], ['Total value (INR)', 'totalValue'], ['Weighted value (INR)', 'weightedValue']),
        rows: [
          ...data.stages.map((stage) => ({ stage: stage.name, count: stage.count, totalValue: stage.totalValue, weightedValue: stage.weightedValue })),
          { stage: 'Total', ...data.totals },
        ],
      };
    }
    case 'lead-sources': {
      const data = await leadSources(context);
      return {
        filename,
        columns: columns(['Lead source', 'source'], ['Leads created', 'created'], ['Converted', 'converted'], ['Conversion rate (%)', 'conversionRate']),
        rows: [
          ...data.rows.map((row) => ({ source: row.sourceName, created: row.created, converted: row.converted, conversionRate: row.conversionRate })),
          { source: 'Total', ...data.totals },
        ],
      };
    }
    case 'sales-by-owner': {
      const data = await salesByOwner(context);
      return {
        filename,
        columns: columns(['Owner', 'owner'], ['Deals won', 'wonCount'], ['Won value (INR)', 'wonValue'], ['Deals lost', 'lostCount'], ['Win rate (%)', 'winRate']),
        rows: [
          ...data.rows.map((row) => ({ owner: row.ownerName ?? UNASSIGNED, wonCount: row.wonCount, wonValue: row.wonValue, lostCount: row.lostCount, winRate: row.winRate })),
          { owner: 'Total', ...data.totals },
        ],
      };
    }
    case 'quotations': {
      const data = await quotations(context);
      return {
        filename,
        columns: columns(['Quotation status', 'status'], ['Quotations', 'count'], ['Total value (INR)', 'value']),
        rows: [...data.rows, { status: 'Total', ...data.totals }],
      };
    }
    case 'overdue-tasks': {
      const data = await overdueTasks(context);
      return {
        filename,
        columns: columns(['Assignee', 'assignee'], ['Overdue tasks', 'count'], ['Oldest due date', 'oldestDueAt']),
        rows: [
          ...data.rows.map((row) => ({ assignee: row.assigneeName ?? UNASSIGNED, count: row.count, oldestDueAt: row.oldestDueAt })),
          { assignee: 'Total', count: data.totals.count, oldestDueAt: null },
        ],
      };
    }
  }
}
