import { z } from 'zod';
import { pageQuerySchema, paginationMetaSchema, sortQuerySchema, booleanQueryParam } from './common.js';
import { leadStatusSchema } from './lead-statuses.js';

/**
 * Mirrors the database's submission_status enum (schema.prisma's
 * SubmissionStatus). SPAM was added by the migration
 * 20261123194049_add_submission_spam_and_archive (D71) — a honeypot hit
 * stores here, not REJECTED, which is reserved for a submission that fails
 * real field-mapping validation (see docs/decisions.md D71).
 */
export const SUBMISSION_STATUSES = ['RECEIVED', 'LEAD_CREATED', 'REJECTED', 'SPAM'] as const;
export const submissionStatusSchema = z.enum(SUBMISSION_STATUSES);
export type SubmissionStatus = z.infer<typeof submissionStatusSchema>;

const ENQUIRY_SORT_FIELDS = ['receivedAt', 'status', 'formType'] as const;

export const listEnquiriesQuerySchema = pageQuerySchema.extend({
  sort: sortQuerySchema(ENQUIRY_SORT_FIELDS),
  status: submissionStatusSchema.optional(),
  formType: z.string().trim().min(1).optional(),
  archived: booleanQueryParam.optional(),
  receivedFrom: z.iso.datetime().optional(),
  receivedTo: z.iso.datetime().optional(),
});
export type ListEnquiriesQuery = z.infer<typeof listEnquiriesQuerySchema>;

/** List-row shape — never carries `payload`, which can hold arbitrary (and potentially large) submitted data; see enquiryDetailResponseSchema for that. */
export const enquiryResponseSchema = z.object({
  id: z.string(),
  externalId: z.string(),
  formType: z.string(),
  receivedAt: z.string(),
  submittedAt: z.string().nullable(),
  sourcePage: z.string().nullable(),
  status: submissionStatusSchema,
  error: z.string().nullable(),
  leadId: z.string().nullable(),
  archivedAt: z.string().nullable(),
  updatedAt: z.string(),
});
export type EnquiryResponse = z.infer<typeof enquiryResponseSchema>;

export const enquiriesListResponseSchema = z.object({
  data: z.array(enquiryResponseSchema),
  meta: paginationMetaSchema,
});

/** A small summary of the Lead a successful intake created — for the Enquiry detail view's linked-lead panel. Null on a submission that never created one (REJECTED, SPAM, or a duplicate replay before the first success). */
const enquiryLeadSummarySchema = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  companyName: z.string().nullable(),
  status: leadStatusSchema,
  archivedAt: z.string().nullable(),
});

/** GET /enquiries/:id only: adds the raw submitted payload and the linked-lead summary that the list view doesn't pay for. */
export const enquiryDetailResponseSchema = z.object({
  data: enquiryResponseSchema.extend({
    payload: z.unknown(),
    lead: enquiryLeadSummarySchema.nullable(),
  }),
});
export type EnquiryDetailResponse = z.infer<typeof enquiryDetailResponseSchema>;
