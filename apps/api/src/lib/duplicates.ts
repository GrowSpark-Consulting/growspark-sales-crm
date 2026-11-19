import type { DuplicateMatch } from '@growspark/shared';
import { prisma } from '../db/prisma.js';
import { scoped } from './scoped.js';
import type { RequestContext } from './context.js';
import type { Prisma } from '../generated/prisma/client.js';

/**
 * D29: duplicate detection warns, it never blocks. Exact match (after
 * normalising) against an existing email, phone, or company name within
 * the same organisation. Archived records are excluded unless asked for —
 * a match against something already archived isn't a live duplicate to
 * warn about. `excludeId` leaves out the record being edited itself, so
 * saving an unchanged record doesn't "duplicate" itself.
 *
 * One function per resource (not a single generic one): each queries a
 * different Prisma model with a different set of normalised columns —
 * Company only has a normalised name, Contact only normalised email/phone,
 * Lead has all three (see docs/decisions.md D15's "extra normalised
 * columns" note). Forcing a shared generic across three different Prisma
 * delegates would cost more than the ~15 lines each saves.
 */

export interface DuplicateFinderOptions {
  excludeId?: string;
  includeArchived?: boolean;
}

export async function findDuplicateCompanies(
  ctx: RequestContext,
  nameNormalized: string | null,
  options: DuplicateFinderOptions = {},
): Promise<DuplicateMatch[]> {
  if (!nameNormalized) return [];

  const rows = await prisma.company.findMany({
    where: {
      ...scoped(ctx),
      nameNormalized,
      ...(options.includeArchived ? {} : { archivedAt: null }),
      ...(options.excludeId ? { id: { not: options.excludeId } } : {}),
    },
    select: { id: true },
  });

  return rows.map((row) => ({ id: row.id, reason: 'companyName' as const }));
}

export async function findDuplicateContacts(
  ctx: RequestContext,
  fields: { emailNormalized: string | null; phoneNormalized: string | null },
  options: DuplicateFinderOptions = {},
): Promise<DuplicateMatch[]> {
  const or: Prisma.ContactWhereInput[] = [];
  if (fields.emailNormalized) or.push({ emailNormalized: fields.emailNormalized });
  if (fields.phoneNormalized) or.push({ phoneNormalized: fields.phoneNormalized });
  if (or.length === 0) return [];

  const rows = await prisma.contact.findMany({
    where: {
      ...scoped(ctx),
      ...(options.includeArchived ? {} : { archivedAt: null }),
      ...(options.excludeId ? { id: { not: options.excludeId } } : {}),
      OR: or,
    },
    select: { id: true, emailNormalized: true, phoneNormalized: true },
  });

  // A row might match on both fields; report email first — it's the more
  // certain identity signal of the two.
  return rows.map((row) => ({
    id: row.id,
    reason:
      fields.emailNormalized && row.emailNormalized === fields.emailNormalized
        ? ('email' as const)
        : ('phone' as const),
  }));
}

export async function findDuplicateLeads(
  ctx: RequestContext,
  fields: {
    emailNormalized: string | null;
    phoneNormalized: string | null;
    companyNameNormalized: string | null;
  },
  options: DuplicateFinderOptions = {},
): Promise<DuplicateMatch[]> {
  const or: Prisma.LeadWhereInput[] = [];
  if (fields.emailNormalized) or.push({ emailNormalized: fields.emailNormalized });
  if (fields.phoneNormalized) or.push({ phoneNormalized: fields.phoneNormalized });
  if (fields.companyNameNormalized) or.push({ companyNameNormalized: fields.companyNameNormalized });
  if (or.length === 0) return [];

  const rows = await prisma.lead.findMany({
    where: {
      ...scoped(ctx),
      ...(options.includeArchived ? {} : { archivedAt: null }),
      ...(options.excludeId ? { id: { not: options.excludeId } } : {}),
      OR: or,
    },
    select: { id: true, emailNormalized: true, phoneNormalized: true, companyNameNormalized: true },
  });

  // Priority when a row matches more than one field: email, then phone,
  // then company name — the least certain signal of the three.
  return rows.map((row) => {
    if (fields.emailNormalized && row.emailNormalized === fields.emailNormalized) {
      return { id: row.id, reason: 'email' as const };
    }
    if (fields.phoneNormalized && row.phoneNormalized === fields.phoneNormalized) {
      return { id: row.id, reason: 'phone' as const };
    }
    return { id: row.id, reason: 'companyName' as const };
  });
}
