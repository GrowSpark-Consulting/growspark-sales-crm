import { z } from 'zod';
import { booleanQueryParam } from './common.js';

/** `includeInactive=true` also returns retired sources, so screens can still show the name a record already has (D93). */
export const listLeadSourcesQuerySchema = z.object({ includeInactive: booleanQueryParam.optional() });
export type ListLeadSourcesQuery = z.infer<typeof listLeadSourcesQuerySchema>;

export const leadSourceResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  isActive: z.boolean(),
  sortOrder: z.number(),
});
export type LeadSourceResponse = z.infer<typeof leadSourceResponseSchema>;

export const leadSourcesListResponseSchema = z.object({
  data: z.array(leadSourceResponseSchema),
});
