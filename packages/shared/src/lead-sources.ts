import { z } from 'zod';

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
