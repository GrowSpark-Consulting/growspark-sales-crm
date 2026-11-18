import { z } from 'zod';

export const LOSS_REASONS = [
  'Price',
  'Competitor',
  'No budget',
  'No decision',
  'Timing',
  'Not a fit',
  'Unresponsive',
  'Other',
] as const;

export const lossReasonSchema = z.enum(LOSS_REASONS);

export type LossReason = z.infer<typeof lossReasonSchema>;
