import { organizationDetailsSchema, type OrganizationDetailsInput } from '@growspark/shared';
import { Prisma, type PrismaClient } from '../generated/prisma/client.js';

/**
 * The organisation's own details printed in the quotation PDF header (D84).
 * Editable on the Settings screen since Day 6a (D93); also settable from a
 * JSON file by `pnpm org:set-details` (local) or `pnpm staging:set-org-details`
 * (staging), each run by the owner, never automatically and never by a
 * seed — so staging only ever holds values the owner chose to write there.
 *
 * Every key is optional; `null` or "" clears a value; a key that is absent
 * is left unchanged; an unknown key is rejected (a typo must not be silently
 * ignored).
 */
export { GSTIN_PATTERN, organizationDetailsSchema } from '@growspark/shared';
export type { OrganizationDetailsInput } from '@growspark/shared';

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
