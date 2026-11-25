import { z } from 'zod';
import { manualEntryPhoneProblem, normalizePhoneInput, parsePhoneInput, phoneNumberProblem } from './phone.js';

/**
 * Settings (Day 6a, D93). Every write here is Admin-only (settings:manage);
 * these schemas are the single source of validation for both the API and the
 * Settings screens.
 */

// ---------------------------------------------------------------------------
// Organisation profile
// ---------------------------------------------------------------------------

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((value) => (value === '' ? null : value));

/**
 * D99: the organisation's phone, checked like every other phone in the app.
 * Free text such as "+91 44 4000 1234" or "044 4000 1234" (an older stored
 * value, or a value in the `org:set-details` JSON file) is first cleaned up
 * the same way a paste into the phone input is; what cannot be read as a
 * complete number is refused with the same message the input shows.
 */
const organizationPhone = z
  .string()
  .trim()
  .max(40)
  .nullable()
  .optional()
  .transform((value) => (value === '' ? null : value && (normalizePhoneInput(value) ?? value)))
  .superRefine((value, ctx) => {
    if (!value) return;
    let problem = manualEntryPhoneProblem(value);
    if (problem && !value.startsWith('+')) {
      // Unreadable free text: say why (too short, too long, no digits).
      const parsed = parsePhoneInput(value);
      problem = parsed.ok ? (phoneNumberProblem(parsed.countryCode, parsed.nationalDigits) ?? problem) : parsed.message;
    }
    if (problem) ctx.addIssue({ code: 'custom', message: problem });
  });

/** Indian GSTIN: 2-digit state code, 10-character PAN, entity digit, "Z", checksum character. */
export const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/**
 * The organisation's own details printed in the quotation PDF header (D84).
 * Every key is optional; `null` or "" clears a value; a key that is absent is
 * left unchanged; an unknown key is rejected (a typo must not be silently
 * ignored). Used by the `org:set-details` scripts and, extended with `name`,
 * by the Settings screen.
 */
export const organizationDetailsSchema = z
  .object({
    legalName: optionalText(200),
    addressLine1: optionalText(200),
    addressLine2: optionalText(200),
    city: optionalText(100),
    state: optionalText(100),
    postalCode: optionalText(20),
    country: optionalText(100),
    phone: organizationPhone,
    email: z
      .union([z.email('Not a valid email address'), z.literal(''), z.null()])
      .optional()
      .transform((value) => (value === '' ? null : value)),
    website: optionalText(200),
    gstin: z
      .union([
        z.string().trim().toUpperCase().regex(GSTIN_PATTERN, 'Not a valid 15-character GSTIN'),
        z.literal(''),
        z.null(),
      ])
      .optional()
      .transform((value) => (value === '' ? null : value)),
  })
  .strict();
export type OrganizationDetailsInput = z.output<typeof organizationDetailsSchema>;

/** The Settings screen's form: the details above plus the organisation's display name. */
export const updateOrganizationSchema = organizationDetailsSchema
  .extend({
    name: z.string().trim().min(1, 'Organisation name is required').max(200).optional(),
  })
  .strict();
export type UpdateOrganizationInput = z.output<typeof updateOrganizationSchema>;

export const organizationResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** Read-only on screen (D93): changing these would shift past reports and quotation numbering. */
  timezone: z.string(),
  currency: z.string(),
  legalName: z.string().nullable(),
  addressLine1: z.string().nullable(),
  addressLine2: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  postalCode: z.string().nullable(),
  country: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  website: z.string().nullable(),
  gstin: z.string().nullable(),
});
export type OrganizationResponse = z.infer<typeof organizationResponseSchema>;
export const organizationResponseEnvelopeSchema = z.object({ data: organizationResponseSchema });

// ---------------------------------------------------------------------------
// Lead sources
// ---------------------------------------------------------------------------

/**
 * Sources the application itself finds by name (intake uses "Website", the
 * manual lead form "Manual", CSV import "Import"). They cannot be renamed or
 * deactivated, or those features would break.
 */
export const LOCKED_LEAD_SOURCE_NAMES = ['Website', 'Manual', 'Import'] as const;

export function isLockedLeadSourceName(name: string): boolean {
  return (LOCKED_LEAD_SOURCE_NAMES as readonly string[]).includes(name);
}

const settingName = (label: string) =>
  z.string().trim().min(1, `${label} is required`).max(60, `${label} must be 60 characters or fewer`);

export const createLeadSourceSchema = z.object({ name: settingName('Name') }).strict();
export type CreateLeadSourceInput = z.infer<typeof createLeadSourceSchema>;

export const updateLeadSourceSchema = z
  .object({
    name: settingName('Name').optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((value) => value.name !== undefined || value.isActive !== undefined, {
    message: 'Nothing to update',
  });
export type UpdateLeadSourceInput = z.infer<typeof updateLeadSourceSchema>;

/** The complete list of ids, in the new order. */
export const reorderSchema = z
  .object({
    ids: z
      .array(z.uuid())
      .min(1)
      .max(200)
      .refine((ids) => new Set(ids).size === ids.length, { message: 'Each id may appear only once' }),
  })
  .strict();
export type ReorderInput = z.infer<typeof reorderSchema>;

export const settingsLeadSourceResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  isActive: z.boolean(),
  sortOrder: z.number(),
  locked: z.boolean(),
  leadCount: z.number(),
});
export type SettingsLeadSourceResponse = z.infer<typeof settingsLeadSourceResponseSchema>;
export const settingsLeadSourcesListResponseSchema = z.object({ data: z.array(settingsLeadSourceResponseSchema) });
export const settingsLeadSourceEnvelopeSchema = z.object({ data: settingsLeadSourceResponseSchema });

// ---------------------------------------------------------------------------
// Pipeline stages
// ---------------------------------------------------------------------------

const probabilitySchema = z.coerce
  .number()
  .int('Probability must be a whole number')
  .min(0, 'Probability must be between 0 and 100')
  .max(100, 'Probability must be between 0 and 100');

/** A new stage is always an OPEN stage, placed after the existing open stages. */
export const createPipelineStageSchema = z
  .object({
    name: settingName('Stage name'),
    probability: probabilitySchema,
  })
  .strict();
export type CreatePipelineStageInput = z.infer<typeof createPipelineStageSchema>;

/** Won/Lost stages accept `name` only; the service refuses a probability for them. */
export const updatePipelineStageSchema = z
  .object({
    name: settingName('Stage name').optional(),
    probability: probabilitySchema.optional(),
  })
  .strict()
  .refine((value) => value.name !== undefined || value.probability !== undefined, {
    message: 'Nothing to update',
  });
export type UpdatePipelineStageInput = z.infer<typeof updatePipelineStageSchema>;

export const settingsPipelineStageResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  position: z.number(),
  probability: z.number(),
  type: z.enum(['OPEN', 'WON', 'LOST']),
  /** Deals currently in this stage, archived ones included. */
  dealCount: z.number(),
  /** True only when no deal and no stage-history row has ever referenced it. */
  deletable: z.boolean(),
});
export type SettingsPipelineStageResponse = z.infer<typeof settingsPipelineStageResponseSchema>;
export const settingsPipelineStagesListResponseSchema = z.object({ data: z.array(settingsPipelineStageResponseSchema) });
export const settingsPipelineStageEnvelopeSchema = z.object({ data: settingsPipelineStageResponseSchema });
