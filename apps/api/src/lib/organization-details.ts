import { z } from 'zod';
import { Prisma, type PrismaClient } from '../generated/prisma/client.js';

/**
 * The organisation's own details printed in the quotation PDF header (D84).
 * There is no Settings screen (out of scope); these are set from a JSON file
 * by `pnpm org:set-details` (local) or `pnpm staging:set-org-details`
 * (staging), each run by the owner, never automatically and never by a
 * seed — so staging only ever holds values the owner chose to write there.
 *
 * Every key is optional; `null` or "" clears a value; a key that is absent
 * is left unchanged; an unknown key is rejected (a typo must not be silently
 * ignored).
 */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((value) => (value === '' ? null : value));

/** Indian GSTIN: 2-digit state code, 10-character PAN, entity digit, "Z", checksum character. */
export const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export const organizationDetailsSchema = z
  .object({
    legalName: optionalText(200),
    addressLine1: optionalText(200),
    addressLine2: optionalText(200),
    city: optionalText(100),
    state: optionalText(100),
    postalCode: optionalText(20),
    country: optionalText(100),
    phone: optionalText(40),
    email: z
      .union([z.email('Not a valid email address'), z.literal(''), z.null()])
      .optional()
      .transform((value) => (value === '' ? null : value)),
    website: optionalText(200),
    gstin: z
      .union([z.string().trim().toUpperCase().regex(GSTIN_PATTERN, 'Not a valid 15-character GSTIN'), z.literal(''), z.null()])
      .optional()
      .transform((value) => (value === '' ? null : value)),
  })
  .strict();
export type OrganizationDetailsInput = z.output<typeof organizationDetailsSchema>;

export const ORGANIZATION_DETAIL_FIELDS = Object.keys(organizationDetailsSchema.shape) as (keyof OrganizationDetailsInput)[];

/** Writes only the keys present in `details`, plus one audit row (system action, field names only). */
export async function applyOrganizationDetails(
  client: PrismaClient,
  organizationId: string,
  details: OrganizationDetailsInput,
): Promise<string[]> {
  const changedFields = ORGANIZATION_DETAIL_FIELDS.filter((field) => details[field] !== undefined);
  if (changedFields.length === 0) return [];
  const data: Prisma.OrganizationUpdateInput = {};
  for (const field of changedFields) {
    data[field] = details[field] ?? null;
  }
  await client.$transaction(async (tx) => {
    await tx.organization.update({ where: { id: organizationId }, data });
    await tx.auditEvent.create({
      data: {
        organizationId,
        actorId: null,
        action: 'organization.details_updated',
        entityType: 'organization',
        entityId: organizationId,
        metadata: { changedFields },
      },
    });
  });
  return changedFields;
}
