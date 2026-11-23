import { z } from 'zod';
import { activityResponseSchema } from './activities.js';
import { pipelineSummaryResponseSchema } from './pipeline.js';

export const workspaceScopeSchema = z.enum(['mine', 'all']).default('all');
export const todayQuerySchema = z.object({ scope: z.enum(['mine', 'all']).default('mine') });
export type TodayQuery = z.infer<typeof todayQuerySchema>;
export const dashboardQuerySchema = z.object({
  from: z.iso.date().optional(), to: z.iso.date().optional(), scope: workspaceScopeSchema,
}).refine((value) => !value.from || !value.to || value.from <= value.to, { message: '`from` must be on or before `to`', path: ['from'] });

export const todayItemSchema = z.object({
  id: z.string(), title: z.string(), href: z.string(), type: z.string().optional(),
  dueAt: z.string().nullable().optional(),
  recordType: z.enum(['leads', 'contacts', 'companies', 'deals']).optional(), recordId: z.string().optional(),
});
export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;
const todaySectionSchema = z.object({ items: z.array(todayItemSchema), total: z.number().int().nonnegative() });
export const todayResponseSchema = z.object({
  data: z.object({
    tasksDueToday: todaySectionSchema, overdueTasks: todaySectionSchema, meetings: todaySectionSchema,
    newLeads: todaySectionSchema, closingDeals: todaySectionSchema, dealsWithoutActivity: todaySectionSchema,
    recentlyUpdatedDeals: todaySectionSchema,
  }),
});
export type TodayResponse = z.infer<typeof todayResponseSchema>;

const countValueSchema = z.object({ count: z.number().int().nonnegative(), value: z.string(), weightedValue: z.string() });
export const dashboardResponseSchema = z.object({
  data: z.object({
    range: z.object({ from: z.string(), to: z.string() }), scope: z.enum(['mine', 'all']),
    metrics: z.object({
      leadsCreated: z.number().int().nonnegative(), newLeads: z.number().int().nonnegative(),
      qualifiedLeads: z.number().int().nonnegative(), activeLeads: z.number().int().nonnegative(),
      leadConversionRate: z.string(), openDeals: countValueSchema,
      wonDeals: z.number().int().nonnegative(), lostDeals: z.number().int().nonnegative(),
      wonRevenue: z.string(), winRate: z.string(), overdueActivities: z.number().int().nonnegative(),
    }),
    leadsBySource: z.array(z.object({ sourceId: z.string(), sourceName: z.string(), count: z.number().int().nonnegative() })),
    leadsByStatus: z.array(z.object({ status: z.string(), count: z.number().int().nonnegative() })),
    pipelineByStage: pipelineSummaryResponseSchema.shape.data,
    monthlyWonRevenue: z.array(z.object({ month: z.string(), value: z.string() })),
    recentActivity: z.array(activityResponseSchema),
  }),
});
