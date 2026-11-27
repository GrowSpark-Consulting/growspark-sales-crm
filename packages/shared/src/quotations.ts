import { z } from 'zod';
import { booleanQueryParam, pageQuerySchema, paginationMetaSchema, sortQuerySchema } from './common.js';

export const QUOTATION_STATUSES = ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED'] as const;
export const quotationStatusSchema = z.enum(QUOTATION_STATUSES);
export type QuotationStatus = z.infer<typeof quotationStatusSchema>;

/**
 * The only status changes a user can request (D83). EXPIRED is never set by
 * hand — a SENT quotation becomes EXPIRED automatically once its valid-until
 * date has passed. ACCEPTED, REJECTED and EXPIRED are final; re-quote with
 * Duplicate instead.
 */
export const QUOTATION_STATUS_TRANSITIONS: Readonly<Record<QuotationStatus, readonly QuotationStatus[]>> = {
  DRAFT: ['SENT'],
  SENT: ['ACCEPTED', 'REJECTED'],
  ACCEPTED: [],
  REJECTED: [],
  EXPIRED: [],
};

/** Default GST rate of a new line item (D101); every line carries its own rate, 0 (exempt) is allowed. */
export const DEFAULT_QUOTATION_TAX_PERCENT = '18';
export const DEFAULT_QUOTATION_VALIDITY_DAYS = 30;
export const MAX_QUOTATION_LINE_ITEMS = 100;

/**
 * Decimal inputs arrive as strings (preferred — exact) or JSON numbers. A
 * number is converted with String(), which gives JavaScript's shortest exact
 * round-trip text ("0.1", "1.15"), then validated as text — the value is
 * never multiplied or rounded as a float on the way in.
 */
function decimalText(pattern: RegExp, message: string) {
  return z
    .union([z.number(), z.string()])
    .transform((value) => (typeof value === 'number' ? String(value) : value.trim()))
    .pipe(z.string().regex(pattern, message));
}

const moneyInput = decimalText(/^\d{1,12}(\.\d{1,2})?$/, 'Enter an amount with at most 2 decimal places');
const quantityInput = decimalText(/^\d{1,10}(\.\d{1,2})?$/, 'Enter a quantity with at most 2 decimal places').refine(
  (value) => Number(value) > 0,
  'Quantity must be more than 0',
);
const percentInput = decimalText(/^\d{1,3}(\.\d{1,2})?$/, 'Enter a percentage with at most 2 decimal places').refine(
  (value) => Number(value) <= 100,
  'Percentage cannot be more than 100',
);

export const quotationLineItemInputSchema = z.object({
  description: z.string().trim().min(1, 'Description is required').max(500, 'Description is too long'),
  quantity: quantityInput,
  unitPrice: moneyInput,
  discountPercent: percentInput.optional(),
  /** Any rate 0–100 with up to 2 decimals (0, 5, 12.5, 0.25…). Omitted means the default rate (18). */
  gstPercent: percentInput.optional(),
});
export type QuotationLineItemInput = z.input<typeof quotationLineItemInputSchema>;

const optionalLongText = z.string().trim().max(5000, 'Text is too long').nullable().optional();

export const quotationCreatableFields = {
  companyId: z.uuid('A company is required'),
  contactId: z.uuid('A contact is required'),
  dealId: z.uuid().nullable().optional(),
  ownerId: z.uuid().nullable().optional(),
  issueDate: z.iso.date().optional(),
  validUntil: z.iso.date().optional(),
  /** true: line prices already include GST; false (default): GST is added on top (D101). */
  pricesIncludeTax: z.boolean().optional(),
  terms: optionalLongText,
  notes: optionalLongText,
  lineItems: z
    .array(quotationLineItemInputSchema)
    .min(1, 'Add at least one line item')
    .max(MAX_QUOTATION_LINE_ITEMS, `At most ${MAX_QUOTATION_LINE_ITEMS} line items`),
};

const validUntilNotBeforeIssue = (value: { issueDate?: string | undefined; validUntil?: string | undefined }) =>
  !value.issueDate || !value.validUntil || value.validUntil >= value.issueDate;
const validUntilMessage = { message: 'Valid until cannot be before the issue date', path: ['validUntil'] as PropertyKey[] };

export const createQuotationSchema = z.object(quotationCreatableFields).refine(validUntilNotBeforeIssue, validUntilMessage);
export type CreateQuotationInput = z.output<typeof createQuotationSchema>;

export const updateQuotationSchema = z
  .object(quotationCreatableFields)
  .partial()
  .refine(validUntilNotBeforeIssue, validUntilMessage);
export type UpdateQuotationInput = z.output<typeof updateQuotationSchema>;

/** Line items + the inclusive/exclusive toggle: everything the money rule needs (POST /quotations/calculate). */
export const calculateQuotationSchema = z.object({
  pricesIncludeTax: z.boolean().optional(),
  lineItems: quotationCreatableFields.lineItems,
});
export type CalculateQuotationInput = z.output<typeof calculateQuotationSchema>;

export const changeQuotationStatusSchema = z.object({
  status: z.enum(['SENT', 'ACCEPTED', 'REJECTED']),
});
export type ChangeQuotationStatusInput = z.infer<typeof changeQuotationStatusSchema>;

const QUOTATION_SORT_FIELDS = ['number', 'issueDate', 'validUntil', 'total', 'createdAt', 'updatedAt'] as const;

export const listQuotationsQuerySchema = pageQuerySchema.extend({
  sort: sortQuerySchema(QUOTATION_SORT_FIELDS),
  /** Matches the quotation number or the company name. */
  q: z.string().trim().min(1).optional(),
  status: quotationStatusSchema.optional(),
  companyId: z.uuid().optional(),
  contactId: z.uuid().optional(),
  dealId: z.uuid().optional(),
  ownerId: z.uuid().optional(),
  issuedFrom: z.iso.date().optional(),
  issuedTo: z.iso.date().optional(),
  archived: booleanQueryParam.optional(),
});
export type ListQuotationsQuery = z.infer<typeof listQuotationsQuerySchema>;

export const quotationGstBreakdownRowSchema = z.object({
  /** Normalised rate: "18", "12.5", "0.25". */
  rate: z.string(),
  taxable: z.string(),
  gst: z.string(),
});

export const quotationTotalsSchema = z.object({
  /** Σ taxable (pre-GST) amounts. */
  subtotal: z.string(),
  gstBreakdown: z.array(quotationGstBreakdownRowSchema),
  taxAmount: z.string(),
  total: z.string(),
  /** Per line: what the customer pays for the line. */
  lineTotals: z.array(z.string()),
});
export type QuotationTotals = z.infer<typeof quotationTotalsSchema>;

export const quotationLineItemResponseSchema = z.object({
  id: z.string(),
  position: z.number(),
  description: z.string(),
  quantity: z.string(),
  unitPrice: z.string(),
  discountPercent: z.string(),
  gstPercent: z.string(),
  /** The line's pre-GST value (what GST is charged on). */
  taxableAmount: z.string(),
  gstAmount: z.string(),
  /** What the customer pays for the line: taxable + GST (exclusive) or the entered amount (inclusive). */
  lineTotal: z.string(),
});
export type QuotationLineItemResponse = z.infer<typeof quotationLineItemResponseSchema>;

export const quotationResponseSchema = z.object({
  id: z.string(),
  number: z.string(),
  version: z.number(),
  /** The PRD's "PDF reference": number + version, e.g. "Q-2026-0001-v3" (no file is stored). */
  pdfReference: z.string(),
  companyId: z.string(),
  companyName: z.string(),
  contactId: z.string(),
  contactName: z.string(),
  dealId: z.string().nullable(),
  dealName: z.string().nullable(),
  ownerId: z.string().nullable(),
  ownerName: z.string().nullable(),
  /** Always the effective status: a SENT quotation past its valid-until date reads as EXPIRED. */
  status: quotationStatusSchema,
  issueDate: z.string(),
  validUntil: z.string(),
  currency: z.string(),
  pricesIncludeTax: z.boolean(),
  /** Σ line taxable amounts (pre-GST). */
  subtotal: z.string(),
  taxAmount: z.string(),
  total: z.string(),
  /** GST by rate, built from the stored line amounts. Present on single-quotation responses; omitted from list rows. */
  gstBreakdown: z.array(quotationGstBreakdownRowSchema).optional(),
  terms: z.string().nullable(),
  notes: z.string().nullable(),
  sentAt: z.string().nullable(),
  archivedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  /** Present on single-quotation responses; omitted from list rows. */
  lineItems: z.array(quotationLineItemResponseSchema).optional(),
});
export type QuotationResponse = z.infer<typeof quotationResponseSchema>;

export const quotationsListResponseSchema = z.object({
  data: z.array(quotationResponseSchema),
  meta: paginationMetaSchema,
});
