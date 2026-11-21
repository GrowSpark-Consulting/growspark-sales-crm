import { z } from 'zod';
import { booleanQueryParam, pageQuerySchema, paginationMetaSchema, sortQuerySchema } from './common.js';
import { prioritySchema } from './priorities.js';

export const activityTypeSchema = z.enum(['TASK', 'CALL', 'MEETING', 'NOTE']);
export const activityStatusSchema = z.enum(['OPEN', 'DONE', 'CANCELLED']);
export const nextActivitySummarySchema = z.object({
  type: z.enum(['TASK', 'CALL', 'MEETING']),
  subject: z.string(),
  dueAt: z.string().nullable(),
  isOverdue: z.boolean(),
});
export type NextActivitySummary = z.infer<typeof nextActivitySummarySchema>;
const optionalDate = z.iso.datetime().nullable().optional();

const activityFields = {
  type: activityTypeSchema,
  subject: z.string().trim().min(1).max(300),
  description: z.string().trim().max(5000).nullable().optional(),
  priority: prioritySchema.optional(),
  dueAt: optionalDate,
  startAt: optionalDate,
  endAt: optionalDate,
  reminderAt: optionalDate,
  assigneeId: z.uuid().nullable().optional(),
  leadId: z.uuid().nullable().optional(),
  contactId: z.uuid().nullable().optional(),
  companyId: z.uuid().nullable().optional(),
  dealId: z.uuid().nullable().optional(),
};

const hasLink = (value: { leadId?: string | null | undefined; contactId?: string | null | undefined; companyId?: string | null | undefined; dealId?: string | null | undefined }) =>
  Boolean(value.leadId || value.contactId || value.companyId || value.dealId);

export const createActivitySchema = z.object(activityFields).refine(hasLink, {
  message: 'Link this activity to at least one CRM record', path: ['leadId'],
});
export type CreateActivityInput = z.infer<typeof createActivitySchema>;

export const updateActivitySchema = z.object(activityFields).partial().refine((value) => Object.keys(value).length > 0, {
  message: 'At least one field must be provided',
});
export type UpdateActivityInput = z.infer<typeof updateActivitySchema>;

const ACTIVITY_SORT_FIELDS = ['createdAt', 'updatedAt', 'dueAt', 'startAt', 'subject'] as const;
export const listActivitiesQuerySchema = pageQuerySchema.extend({
  sort: sortQuerySchema(ACTIVITY_SORT_FIELDS),
  type: activityTypeSchema.optional(),
  status: activityStatusSchema.optional(),
  dueFrom: z.iso.datetime().optional(),
  dueTo: z.iso.datetime().optional(),
  overdue: booleanQueryParam.optional(),
  assigneeId: z.uuid().optional(),
  leadId: z.uuid().optional(),
  contactId: z.uuid().optional(),
  companyId: z.uuid().optional(),
  dealId: z.uuid().optional(),
}).superRefine((value, ctx) => {
  if (value.dueFrom && value.dueTo && Date.parse(value.dueFrom) > Date.parse(value.dueTo)) {
    ctx.addIssue({ code: 'custom', path: ['dueTo'], message: 'dueTo must be on or after dueFrom' });
  }
});
export type ListActivitiesQuery = z.infer<typeof listActivitiesQuerySchema>;

export const activityResponseSchema = z.object({
  id: z.string(), type: activityTypeSchema, subject: z.string(), description: z.string().nullable(),
  status: activityStatusSchema, priority: prioritySchema, dueAt: z.string().nullable(),
  startAt: z.string().nullable(), endAt: z.string().nullable(), reminderAt: z.string().nullable(),
  completedAt: z.string().nullable(), assigneeId: z.string().nullable(), createdById: z.string(),
  leadId: z.string().nullable(), contactId: z.string().nullable(), companyId: z.string().nullable(),
  dealId: z.string().nullable(), createdAt: z.string(), updatedAt: z.string(),
});
export type ActivityResponse = z.infer<typeof activityResponseSchema>;

export const activitiesListResponseSchema = z.object({
  data: z.array(activityResponseSchema), meta: paginationMetaSchema,
});
export const activityResponseEnvelopeSchema = z.object({ data: activityResponseSchema });

export const timelineQuerySchema = pageQuerySchema.extend({});
export const timelineEntrySchema = z.object({
  id: z.string(), kind: z.enum(['ACTIVITY', 'LEAD_STATUS', 'DEAL_STAGE', 'CONVERSION']),
  at: z.string(), title: z.string(), description: z.string().nullable(), actorId: z.string().nullable(),
});
export type TimelineEntry = z.infer<typeof timelineEntrySchema>;
export const timelineResponseSchema = z.object({
  data: z.array(timelineEntrySchema), meta: paginationMetaSchema,
  nextActivity: activityResponseSchema.nullable(),
});
