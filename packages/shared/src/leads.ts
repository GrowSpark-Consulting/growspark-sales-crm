import { z } from 'zod';
import { pageQuerySchema, paginationMetaSchema, sortQuerySchema, booleanQueryParam } from './common.js';
import { duplicateMatchSchema } from './duplicates.js';
import { leadStatusSchema, openLeadStatusSchema } from './lead-statuses.js';
import { prioritySchema } from './priorities.js';
import { phoneFieldSchema } from './phone.js';

function optionalTrimmed(max: number) {
  return z.string().trim().max(max).optional();
}

/**
 * Exported (not just module-local) so the frontend (package 2.6) can build
 * its own form-resolver schema from these same field validators — same
 * reasoning as Company's `companyFormSchema` (D38): `nextFollowUpAt`/
 * `estimatedBudget` aren't coerced here, but the frontend's create vs edit
 * forms genuinely differ in which *extra* fields they add on top of this
 * shared set (edit excludes `requirement`/`capturedFields` entirely,
 * matching `updateLeadSchema` below), which ruling out `.extend()` on the
 * refined `createLeadSchema` would otherwise force into a second,
 * hand-duplicated field list.
 */
export const leadCreatableFields = {
  firstName: z.string().trim().min(1, 'First name is required').max(200, 'First name is too long'),
  lastName: optionalTrimmed(200),
  email: z.string().trim().max(320, 'Email is too long').optional(),
  // D41: country-code-select + number composed client-side into a single
  // canonical E.164 string; validated strictly here for manual CRM entry.
  phone: phoneFieldSchema.optional(),
  companyName: optionalTrimmed(300),
  website: optionalTrimmed(2000),
  jobTitle: optionalTrimmed(200),
  industry: optionalTrimmed(200),
  sourceId: z.uuid().optional(),
  sourceDetail: optionalTrimmed(200),
  priority: prioritySchema.optional(),
  ownerId: z.uuid().nullable().optional(),
  purchaseTimeline: optionalTrimmed(200),
  nextFollowUpAt: z.iso.datetime().nullable().optional(),
  notes: z.string().trim().max(5000, 'Notes are too long').optional(),
};

/**
 * D29: a lead needs a name plus at least one of an email or a phone.
 * `requirement`/`capturedFields` are only settable here — see
 * updateLeadSchema below for why they're read-only after creation.
 */
export const createLeadSchema = z
  .object({
    ...leadCreatableFields,
    requirement: z.string().trim().max(5000, 'Requirement is too long').optional(),
    estimatedBudget: z.union([z.number().nonnegative('Estimated budget cannot be negative'), z.string().regex(/^\d+(\.\d{1,2})?$/, 'Enter a valid amount')]).optional(),
    capturedFields: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((data) => Boolean(data.email?.trim()) || Boolean(data.phone?.trim()), {
    message: 'Provide an email or a phone number',
    path: ['email'],
  });
export type CreateLeadInput = z.infer<typeof createLeadSchema>;

/**
 * Deliberately excludes `requirement` and `capturedFields` — the roadmap's
 * 2.3 brief: "the lead keeps its original enquiry fields ... read-only
 * after creation." Also excludes `status`/`convertedAt`: status changes go
 * through the dedicated `updateLeadStatusSchema` endpoint only (D29).
 */
export const updateLeadSchema = z
  .object(leadCreatableFields)
  .partial()
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' });
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;

/**
 * D29: any open status may move to any other open status directly.
 * CONVERTED is reachable only through the Day 3 convert action — excluded
 * here structurally (openLeadStatusSchema), not just checked at runtime.
 * No `note` field — see docs/decisions.md D32.
 */
export const updateLeadStatusSchema = z.object({
  status: openLeadStatusSchema,
});
export type UpdateLeadStatusInput = z.infer<typeof updateLeadStatusSchema>;

const LEAD_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'firstName',
  'lastName',
  'status',
  'priority',
  'nextFollowUpAt',
] as const;

export const listLeadsQuerySchema = pageQuerySchema.extend({
  sort: sortQuerySchema(LEAD_SORT_FIELDS),
  q: z.string().trim().min(1).optional(),
  status: leadStatusSchema.optional(),
  sourceId: z.uuid().optional(),
  ownerId: z.uuid().optional(),
  priority: prioritySchema.optional(),
  archived: booleanQueryParam.optional(),
  createdFrom: z.iso.datetime().optional(),
  createdTo: z.iso.datetime().optional(),
});
export type ListLeadsQuery = z.infer<typeof listLeadsQuerySchema>;

export const leadDuplicateCheckQuerySchema = z.object({
  email: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  companyName: z.string().trim().optional(),
  excludeId: z.uuid().optional(),
});
export type LeadDuplicateCheckQuery = z.infer<typeof leadDuplicateCheckQuerySchema>;

export const leadResponseSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  companyName: z.string().nullable(),
  website: z.string().nullable(),
  jobTitle: z.string().nullable(),
  industry: z.string().nullable(),
  sourceId: z.string(),
  sourceDetail: z.string().nullable(),
  status: leadStatusSchema,
  priority: prioritySchema,
  ownerId: z.string().nullable(),
  requirement: z.string().nullable(),
  estimatedBudget: z.string().nullable(),
  purchaseTimeline: z.string().nullable(),
  nextFollowUpAt: z.string().nullable(),
  notes: z.string().nullable(),
  capturedFields: z.unknown().nullable(),
  convertedAt: z.string().nullable(),
  archivedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  /**
   * Package 3.5 (not in 3.1's original brief): what the Day 3 convert
   * action created or linked, for the Converted panel's links. Always
   * `null` on a lead that hasn't been converted; only ever populated by
   * GET /leads/:id (list rows don't pay for the extra join, since no list
   * view needs it).
   */
  conversion: z
    .object({
      companyId: z.string(),
      contactId: z.string(),
      dealId: z.string().nullable(),
    })
    .nullable(),
});
export type LeadResponse = z.infer<typeof leadResponseSchema>;

export const leadsListResponseSchema = z.object({
  data: z.array(leadResponseSchema),
  meta: paginationMetaSchema,
});

/** Create/update response: D29 duplicates warn, so they ride alongside `data`, never replacing it. */
export const leadWithDuplicatesResponseSchema = z.object({
  data: leadResponseSchema,
  duplicates: z.array(duplicateMatchSchema),
});

export const leadDuplicatesResponseSchema = z.object({
  data: z.array(duplicateMatchSchema),
});

export const leadStatusHistoryResponseSchema = z.object({
  id: z.string(),
  leadId: z.string(),
  fromStatus: leadStatusSchema.nullable(),
  toStatus: leadStatusSchema,
  changedById: z.string(),
  // D44: the actor's name, joined at query time — no schema change, users
  // are never hard-deleted (only deactivated, D25), so this is always set.
  changedByName: z.string(),
  createdAt: z.string(),
});
export type LeadStatusHistoryResponse = z.infer<typeof leadStatusHistoryResponseSchema>;

export const leadStatusHistoryListResponseSchema = z.object({
  data: z.array(leadStatusHistoryResponseSchema),
});
