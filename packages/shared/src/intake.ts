import { z } from 'zod';

/**
 * The website's submission envelope. `fields` is intentionally a loose,
 * open record rather than a per-formType strict shape: the real Grow Spark
 * website form is not connected yet (CLAUDE.md — that repo is off limits
 * until a separate, explicitly-approved patch), so its exact field names
 * are not confirmed. Constraining this now risks rejecting a real
 * submission later over a shape nobody has verified; the roadmap's own
 * mapping table (see docs/intake-contract.md) is applied leniently in
 * apps/api's intake module instead of enforced here.
 *
 * `hp` is the honeypot: a field a real visitor never sees or fills (hidden
 * by CSS on the eventual website form). Any non-empty value here marks the
 * submission as spam — handled entirely server-side, and deliberately kept
 * out of `fields` so it never round-trips into a Lead's capturedFields.
 */
export const websiteEnquiryIntakeSchema = z.object({
  formType: z.string().trim().min(1, 'formType is required').max(100, 'formType is too long'),
  submittedAt: z.iso.datetime({ offset: true }).optional(),
  sourcePage: z.string().trim().max(2000, 'sourcePage is too long').optional(),
  fields: z
    .record(z.string(), z.unknown())
    .refine((fields) => Object.keys(fields).length <= 50, 'Too many fields'),
  hp: z.string().max(500).optional(),
});
export type WebsiteEnquiryIntakeInput = z.infer<typeof websiteEnquiryIntakeSchema>;

export const intakeResponseSchema = z.object({
  data: z.object({
    submissionId: z.string(),
    leadId: z.string().nullable(),
    duplicate: z.boolean(),
    possibleDuplicateLeadIds: z.array(z.string()),
  }),
});
export type IntakeResponse = z.infer<typeof intakeResponseSchema>;
