import { z } from 'zod';
import { dashboardQuerySchema } from './workspace.js';
import { quotationStatusSchema } from './quotations.js';

/**
 * Reports take exactly the Home dashboard's filters — an optional date range
 * (ISO dates, the organisation's calendar days, defaulting to the current
 * month) and an All / Mine scope — so the two pages can be reconciled
 * figure by figure (D92).
 */
export const reportsQuerySchema = dashboardQuerySchema;
export type ReportsQuery = z.infer<typeof reportsQuerySchema>;

export const REPORT_KEYS = ['pipeline-by-stage', 'lead-sources', 'sales-by-owner', 'quotations', 'overdue-tasks'] as const;
export const reportKeySchema = z.enum(REPORT_KEYS);
export type ReportKey = z.infer<typeof reportKeySchema>;
export const reportExportParamsSchema = z.object({ report: reportKeySchema });
export type ReportExportParams = z.infer<typeof reportExportParamsSchema>;

const count = z.number().int().nonnegative();
/** Money and percentages travel as exact decimal strings computed in Postgres, never JS floats. */
const decimal = z.string();

export const pipelineReportSchema = z.object({
  stages: z.array(z.object({ stageId: z.string(), name: z.string(), position: z.number().int(), count, totalValue: decimal, weightedValue: decimal })),
  totals: z.object({ count, totalValue: decimal, weightedValue: decimal }),
});

export const leadSourcesReportSchema = z.object({
  rows: z.array(z.object({ sourceId: z.string(), sourceName: z.string(), created: count, converted: count, conversionRate: decimal })),
  totals: z.object({ created: count, converted: count, conversionRate: decimal }),
});

export const salesByOwnerReportSchema = z.object({
  rows: z.array(z.object({ ownerId: z.string().nullable(), ownerName: z.string().nullable(), wonCount: count, wonValue: decimal, lostCount: count, winRate: decimal })),
  totals: z.object({ wonCount: count, wonValue: decimal, lostCount: count, winRate: decimal }),
});

export const quotationsReportSchema = z.object({
  rows: z.array(z.object({ status: quotationStatusSchema, count, value: decimal })),
  totals: z.object({ count, value: decimal }),
});

export const overdueTasksReportSchema = z.object({
  rows: z.array(z.object({ assigneeId: z.string().nullable(), assigneeName: z.string().nullable(), count, oldestDueAt: z.string() })),
  totals: z.object({ count }),
});

export const reportsResponseSchema = z.object({
  data: z.object({
    range: z.object({ from: z.string(), to: z.string() }),
    scope: z.enum(['mine', 'all']),
    pipelineByStage: pipelineReportSchema,
    leadSources: leadSourcesReportSchema,
    salesByOwner: salesByOwnerReportSchema,
    quotations: quotationsReportSchema,
    overdueTasks: overdueTasksReportSchema,
  }),
});
export type ReportsResponse = z.infer<typeof reportsResponseSchema>;
export type ReportsData = ReportsResponse['data'];
