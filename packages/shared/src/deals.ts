import { z } from 'zod';
import { pageQuerySchema, paginationMetaSchema, sortQuerySchema, booleanQueryParam } from './common.js';
import { lossReasonSchema } from './loss-reasons.js';

function optionalTrimmed(max: number) {
  return z.string().trim().max(max).optional();
}

export const dealStatusSchema = z.enum(['OPEN', 'WON', 'LOST']);
export type DealStatus = z.infer<typeof dealStatusSchema>;

/**
 * Exported (not just module-local), same reason as Lead/Contact's
 * *CreatableFields (D39/D43): `stageId` is a create-only convenience (pick
 * a starting stage other than the default) and is deliberately NOT part of
 * this shared map — stage changes after creation only ever go through the
 * dedicated POST /deals/:id/stage action, never a plain PATCH.
 */
export const dealCreatableFields = {
  name: z.string().trim().min(1, 'Deal name is required').max(300, 'Deal name is too long'),
  companyId: z.uuid('A company is required'),
  value: z.coerce.number().nonnegative('Value cannot be negative').optional(),
  probability: z.coerce.number().int('Probability must be a whole number').min(0).max(100).optional(),
  expectedCloseDate: z.iso.date().nullable().optional(),
  ownerId: z.uuid().nullable().optional(),
  dealType: optionalTrimmed(100),
  sourceId: z.uuid().nullable().optional(),
};

export const createDealSchema = z.object({
  ...dealCreatableFields,
  /** Create-only: picks a starting stage other than the pipeline's first open one. */
  stageId: z.uuid().optional(),
});
export type CreateDealInput = z.infer<typeof createDealSchema>;

export const updateDealSchema = z.object(dealCreatableFields).partial();
export type UpdateDealInput = z.infer<typeof updateDealSchema>;

export const moveDealStageSchema = z.object({ stageId: z.uuid() });
export type MoveDealStageInput = z.infer<typeof moveDealStageSchema>;

export const closeDealSchema = z
  .object({
    status: z.enum(['WON', 'LOST']),
    lostReason: lossReasonSchema.optional(),
    lostNote: z.string().trim().max(2000, 'Note is too long').optional(),
  })
  .refine((data) => data.status !== 'LOST' || Boolean(data.lostReason), {
    message: 'A reason is required when marking a deal Lost',
    path: ['lostReason'],
  });
export type CloseDealInput = z.infer<typeof closeDealSchema>;

export const setDealContactsSchema = z
  .object({
    contactIds: z.array(z.uuid()),
    primaryContactId: z.uuid().optional(),
  })
  .refine((data) => !data.primaryContactId || data.contactIds.includes(data.primaryContactId), {
    message: 'primaryContactId must be one of contactIds',
    path: ['primaryContactId'],
  });
export type SetDealContactsInput = z.infer<typeof setDealContactsSchema>;

const DEAL_SORT_FIELDS = ['name', 'value', 'probability', 'expectedCloseDate', 'createdAt', 'updatedAt'] as const;

export const listDealsQuerySchema = pageQuerySchema.extend({
  sort: sortQuerySchema(DEAL_SORT_FIELDS),
  q: z.string().trim().min(1).optional(),
  status: dealStatusSchema.optional(),
  stageId: z.uuid().optional(),
  companyId: z.uuid().optional(),
  ownerId: z.uuid().optional(),
  archived: booleanQueryParam.optional(),
});
export type ListDealsQuery = z.infer<typeof listDealsQuerySchema>;

export const dealResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  companyId: z.string(),
  pipelineId: z.string(),
  stageId: z.string(),
  value: z.string(),
  currency: z.string(),
  probability: z.number(),
  expectedCloseDate: z.string().nullable(),
  ownerId: z.string().nullable(),
  dealType: z.string().nullable(),
  sourceId: z.string().nullable(),
  status: dealStatusSchema,
  closedAt: z.string().nullable(),
  lostReason: z.string().nullable(),
  lostNote: z.string().nullable(),
  archivedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type DealResponse = z.infer<typeof dealResponseSchema>;

export const dealsListResponseSchema = z.object({
  data: z.array(dealResponseSchema),
  meta: paginationMetaSchema,
});

export const dealContactResponseSchema = z.object({
  contactId: z.string(),
  isPrimary: z.boolean(),
});
export type DealContactResponse = z.infer<typeof dealContactResponseSchema>;

export const dealContactsResponseSchema = z.object({ data: z.array(dealContactResponseSchema) });
