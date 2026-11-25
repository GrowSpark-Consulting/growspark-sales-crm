import {
  PERMISSIONS,
  SEARCH_RESULTS_PER_GROUP,
  hasPermission,
  type Permission,
  type SearchGroup,
  type SearchGroupType,
  type SearchResponse,
} from '@growspark/shared';
import { prisma } from '../../db/prisma.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { scoped } from '../../lib/scoped.js';
import type { RequestContext } from '../../lib/context.js';

/**
 * Global search (D94). One request searches every record type the caller
 * may read, organisation-scoped, archived records excluded, at most
 * SEARCH_RESULTS_PER_GROUP results per group (one extra row is fetched to
 * know whether more exist).
 *
 * Matching is the same case-insensitive "contains" the list pages use, but
 * applied per word: every word typed must match at least one of the group's
 * fields, so "asha rao" finds a lead whose first name is Asha and last name
 * Rao. No new index or extension (an approved trade-off for this data size).
 */

const MAX_WORDS = 5;
const TAKE = SEARCH_RESULTS_PER_GROUP + 1;

function words(q: string): string[] {
  return q.split(/\s+/).filter(Boolean).slice(0, MAX_WORDS);
}

/**
 * Prisma's `contains` passes `%` and `_` through to ILIKE as wildcards
 * (found by this module's tests: "%%" matched everything), so they and the
 * escape character itself are escaped. Postgres's default LIKE escape is a
 * backslash.
 */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

function contains(value: string) {
  return { contains: escapeLike(value), mode: 'insensitive' as const };
}

/** Every word must match at least one of `fields(word)`. */
function everyWord<T>(terms: string[], fields: (word: string) => T[]): { AND: { OR: T[] }[] } {
  return { AND: terms.map((word) => ({ OR: fields(word) })) };
}

function joinParts(...parts: (string | null | undefined)[]): string {
  return parts.filter((part): part is string => Boolean(part && part.trim())).join(' · ');
}

function fullName(first: string, last: string | null): string {
  return last ? `${first} ${last}` : first;
}

interface GroupSpec {
  type: SearchGroupType;
  label: string;
  permission: Permission;
  listPath: string;
  run: (ctx: RequestContext, terms: string[]) => Promise<SearchGroup['results']>;
}

const GROUPS: GroupSpec[] = [
  {
    type: 'lead',
    label: 'Leads',
    permission: PERMISSIONS.LEADS_READ,
    listPath: '/leads',
    run: async (ctx, terms) => {
      const where: Prisma.LeadWhereInput = {
        ...scoped(ctx),
        archivedAt: null,
        ...everyWord<Prisma.LeadWhereInput>(terms, (word) => [
          { firstName: contains(word) },
          { lastName: contains(word) },
          { email: contains(word) },
          { phone: contains(word) },
          { companyName: contains(word) },
        ]),
      };
      const rows = await prisma.lead.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        take: TAKE,
        select: { id: true, firstName: true, lastName: true, companyName: true, email: true, phone: true },
      });
      return rows.map((row) => ({
        id: row.id,
        title: fullName(row.firstName, row.lastName),
        subtitle: joinParts(row.companyName, row.email ?? row.phone),
        href: `/leads/${row.id}`,
      }));
    },
  },
  {
    type: 'contact',
    label: 'Contacts',
    permission: PERMISSIONS.CONTACTS_READ,
    listPath: '/contacts',
    run: async (ctx, terms) => {
      const rows = await prisma.contact.findMany({
        where: {
          ...scoped(ctx),
          archivedAt: null,
          ...everyWord<Prisma.ContactWhereInput>(terms, (word) => [
            { firstName: contains(word) },
            { lastName: contains(word) },
            { email: contains(word) },
            { phone: contains(word) },
            // Typing a company's name also lists the people who work there.
            { company: { name: contains(word) } },
          ]),
        },
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        take: TAKE,
        select: { id: true, firstName: true, lastName: true, email: true, phone: true, company: { select: { name: true } } },
      });
      return rows.map((row) => ({
        id: row.id,
        title: fullName(row.firstName, row.lastName),
        subtitle: joinParts(row.company?.name, row.email ?? row.phone),
        href: `/contacts/${row.id}`,
      }));
    },
  },
  {
    type: 'company',
    label: 'Companies',
    permission: PERMISSIONS.COMPANIES_READ,
    listPath: '/companies',
    run: async (ctx, terms) => {
      const rows = await prisma.company.findMany({
        where: {
          ...scoped(ctx),
          archivedAt: null,
          ...everyWord<Prisma.CompanyWhereInput>(terms, (word) => [{ name: contains(word) }, { email: contains(word) }]),
        },
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        take: TAKE,
        select: { id: true, name: true, city: true, email: true },
      });
      return rows.map((row) => ({
        id: row.id,
        title: row.name,
        subtitle: joinParts(row.city, row.email),
        href: `/companies/${row.id}`,
      }));
    },
  },
  {
    type: 'deal',
    label: 'Deals',
    permission: PERMISSIONS.DEALS_READ,
    listPath: '/deals',
    run: async (ctx, terms) => {
      const rows = await prisma.deal.findMany({
        where: {
          ...scoped(ctx),
          archivedAt: null,
          ...everyWord<Prisma.DealWhereInput>(terms, (word) => [
            { name: contains(word) },
            // The company is always in the same organisation (enforced on every deal write).
            { company: { name: contains(word) } },
          ]),
        },
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        take: TAKE,
        select: { id: true, name: true, company: { select: { name: true } }, stage: { select: { name: true } } },
      });
      return rows.map((row) => ({
        id: row.id,
        title: row.name,
        subtitle: joinParts(row.company.name, row.stage.name),
        href: `/deals/${row.id}`,
      }));
    },
  },
  {
    type: 'quotation',
    label: 'Quotations',
    permission: PERMISSIONS.QUOTATIONS_READ,
    listPath: '/quotations',
    run: async (ctx, terms) => {
      const rows = await prisma.quotation.findMany({
        where: {
          ...scoped(ctx),
          archivedAt: null,
          ...everyWord<Prisma.QuotationWhereInput>(terms, (word) => [
            { number: contains(word) },
            { company: { name: contains(word) } },
          ]),
        },
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        take: TAKE,
        select: { id: true, number: true, version: true, company: { select: { name: true } } },
      });
      // Status is deliberately not shown: a stored SENT may already be
      // effectively EXPIRED (D86), and search must not run the expiry write.
      return rows.map((row) => ({
        id: row.id,
        title: row.number,
        subtitle: joinParts(row.company.name, `v${row.version}`),
        href: `/quotations/${row.id}`,
      }));
    },
  },
];

export async function search(ctx: RequestContext, q: string): Promise<SearchResponse['data']> {
  const terms = words(q);
  const allowed = GROUPS.filter((group) => hasPermission(ctx.role, group.permission));
  const results = await Promise.all(allowed.map((group) => group.run(ctx, terms)));
  const groups: SearchGroup[] = [];
  allowed.forEach((group, index) => {
    const rows = results[index]!;
    if (rows.length === 0) return;
    groups.push({
      type: group.type,
      label: group.label,
      results: rows.slice(0, SEARCH_RESULTS_PER_GROUP),
      hasMore: rows.length > SEARCH_RESULTS_PER_GROUP,
      seeAllHref: `${group.listPath}?q=${encodeURIComponent(q)}`,
    });
  });
  return { query: q, groups };
}
