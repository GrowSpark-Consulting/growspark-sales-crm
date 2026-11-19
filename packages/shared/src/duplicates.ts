import { z } from 'zod';

/**
 * D29: duplicate detection warns, it never blocks. Shared shape for the
 * "here's what might already exist" hint a create/update response carries
 * alongside its normal `data` — deliberately not the error envelope
 * (`{ error: {...} }`), since this is never a rejection.
 */
export const duplicateMatchSchema = z.object({
  id: z.string(),
  reason: z.enum(['email', 'phone', 'companyName']),
});
export type DuplicateMatch = z.infer<typeof duplicateMatchSchema>;
