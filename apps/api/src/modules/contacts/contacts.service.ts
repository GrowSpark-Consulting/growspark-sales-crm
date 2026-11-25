import { normalizeEmail, normalizePhone } from '@growspark/shared';
import type {
  CreateContactInput,
  UpdateContactInput,
  ListContactsQuery,
  ContactResponse,
  DuplicateMatch,
} from '@growspark/shared';
import { prisma } from '../../db/prisma.js';
import { ApiError } from '../../middleware/error-handler.js';
import { scoped } from '../../lib/scoped.js';
import { writeAudit } from '../../lib/audit.js';
import { toSkipTake, buildPaginationMeta } from '../../lib/pagination.js';
import { buildOrderBy } from '../../lib/list-query.js';
import { CSV_EXPORT_ROW_LIMIT, type CsvColumn } from '../../lib/csv.js';
import { findDuplicateContacts } from '../../lib/duplicates.js';
import type { RequestContext } from '../../lib/context.js';
import type { Contact, Prisma } from '../../generated/prisma/client.js';

const DEFAULT_LIFECYCLE_STATUS = 'ACTIVE';

function toContactResponse(contact: Contact): ContactResponse {
  return {
    id: contact.id,
    companyId: contact.companyId,
    firstName: contact.firstName,
    lastName: contact.lastName,
    email: contact.email,
    phone: contact.phone,
    jobTitle: contact.jobTitle,
    department: contact.department,
    location: contact.location,
    lifecycleStatus: contact.lifecycleStatus,
    ownerId: contact.ownerId,
    notes: contact.notes,
    archivedAt: contact.archivedAt ? contact.archivedAt.toISOString() : null,
    createdAt: contact.createdAt.toISOString(),
    updatedAt: contact.updatedAt.toISOString(),
  };
}

// Only called at a call site that already checked `input.field !== undefined`
// — see companies.service.ts's identical helper for why the signature stays
// on a plain `string`, not `string | undefined` (exactOptionalPropertyTypes).
function blankToNull(value: string): string | null {
  return value === '' ? null : value;
}

async function assertOwnerInOrg(
  tx: Prisma.TransactionClient,
  organizationId: string,
  ownerId: string | null | undefined,
): Promise<void> {
  if (!ownerId) return;
  const owner = await tx.user.findFirst({ where: { id: ownerId, organizationId } });
  if (!owner) {
    throw new ApiError(404, 'NOT_FOUND', 'Owner not found');
  }
}

async function assertCompanyInOrg(
  tx: Prisma.TransactionClient,
  organizationId: string,
  companyId: string | null | undefined,
): Promise<void> {
  if (!companyId) return;
  const company = await tx.company.findFirst({ where: { id: companyId, organizationId } });
  if (!company) {
    throw new ApiError(404, 'NOT_FOUND', 'Company not found');
  }
}

export interface ListContactsResult {
  data: ContactResponse[];
  meta: { page: number; pageSize: number; total: number };
}

/** Shared by listContacts and exportContacts so the two never drift out of sync. */
function buildContactsWhere(ctx: RequestContext, query: ListContactsQuery): Prisma.ContactWhereInput {
  return {
    ...scoped(ctx),
    archivedAt: query.archived ? { not: null } : null,
    ...(query.companyId ? { companyId: query.companyId } : {}),
    ...(query.ownerId ? { ownerId: query.ownerId } : {}),
    ...(query.q
      ? {
          OR: [
            { firstName: { contains: query.q, mode: 'insensitive' } },
            { lastName: { contains: query.q, mode: 'insensitive' } },
            { email: { contains: query.q, mode: 'insensitive' } },
            { phone: { contains: query.q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
}

export async function listContacts(
  ctx: RequestContext,
  query: ListContactsQuery,
): Promise<ListContactsResult> {
  const where = buildContactsWhere(ctx, query);

  const orderBy = buildOrderBy(query.sort, { field: 'createdAt', direction: 'desc' });

  const [rows, total] = await Promise.all([
    prisma.contact.findMany({ where, orderBy, ...toSkipTake(query) }),
    prisma.contact.count({ where }),
  ]);

  return { data: rows.map(toContactResponse), meta: buildPaginationMeta(query, total) };
}

export interface ContactExportRow extends Contact {
  owner: { name: string } | null;
  company: { name: string } | null;
}

/** Same filters/sort as listContacts, uncapped by page/pageSize, capped at CSV_EXPORT_ROW_LIMIT instead. */
export async function exportContacts(ctx: RequestContext, query: ListContactsQuery): Promise<ContactExportRow[]> {
  const where = buildContactsWhere(ctx, query);
  const orderBy = buildOrderBy(query.sort, { field: 'createdAt', direction: 'desc' });

  return prisma.contact.findMany({
    where,
    orderBy,
    take: CSV_EXPORT_ROW_LIMIT,
    include: { owner: { select: { name: true } }, company: { select: { name: true } } },
  });
}

export const CONTACT_EXPORT_COLUMNS: readonly CsvColumn<ContactExportRow>[] = [
  { header: 'Contact ID', value: (r) => r.id },
  { header: 'First name', value: (r) => r.firstName },
  { header: 'Last name', value: (r) => r.lastName },
  { header: 'Email', value: (r) => r.email },
  { header: 'Phone', value: (r) => r.phone },
  { header: 'Job title', value: (r) => r.jobTitle },
  { header: 'Department', value: (r) => r.department },
  { header: 'Location', value: (r) => r.location },
  { header: 'Lifecycle status', value: (r) => r.lifecycleStatus },
  { header: 'Company', value: (r) => r.company?.name ?? null },
  { header: 'Owner', value: (r) => r.owner?.name ?? null },
  { header: 'Notes', value: (r) => r.notes },
  { header: 'Archived at', value: (r) => r.archivedAt },
  { header: 'Created at', value: (r) => r.createdAt },
  { header: 'Updated at', value: (r) => r.updatedAt },
];

export interface ContactMutationResult {
  contact: ContactResponse;
  duplicates: DuplicateMatch[];
}

export async function createContact(
  ctx: RequestContext,
  input: CreateContactInput,
): Promise<ContactMutationResult> {
  const emailNormalized = normalizeEmail(input.email);
  const phoneNormalized = normalizePhone(input.phone);

  const created = await prisma.$transaction(async (tx) => {
    await assertCompanyInOrg(tx, ctx.orgId, input.companyId);
    await assertOwnerInOrg(tx, ctx.orgId, input.ownerId);

    const contact = await tx.contact.create({
      data: {
        organizationId: ctx.orgId,
        companyId: input.companyId,
        firstName: input.firstName,
        lastName: input.lastName ?? null,
        email: input.email ?? null,
        emailNormalized,
        phone: input.phone ?? null,
        phoneNormalized,
        jobTitle: input.jobTitle ?? null,
        department: input.department ?? null,
        location: input.location ?? null,
        lifecycleStatus: input.lifecycleStatus ?? DEFAULT_LIFECYCLE_STATUS,
        ownerId: input.ownerId ?? null,
        notes: input.notes ?? null,
      },
    });
    await writeAudit(tx, ctx, {
      action: 'contact.created',
      entityType: 'contact',
      entityId: contact.id,
      metadata: { firstName: contact.firstName, lastName: contact.lastName },
    });
    return contact;
  });

  const duplicates = await findDuplicateContacts(ctx, { emailNormalized, phoneNormalized }, { excludeId: created.id });
  return { contact: toContactResponse(created), duplicates };
}

export async function getContact(ctx: RequestContext, id: string): Promise<ContactResponse> {
  const contact = await prisma.contact.findFirst({ where: { id, ...scoped(ctx) } });
  if (!contact) {
    throw new ApiError(404, 'NOT_FOUND', 'Contact not found');
  }
  return toContactResponse(contact);
}

export async function updateContact(
  ctx: RequestContext,
  id: string,
  input: UpdateContactInput,
): Promise<ContactMutationResult> {
  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.contact.findFirst({ where: { id, ...scoped(ctx) } });
    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', 'Contact not found');
    }

    await assertCompanyInOrg(tx, ctx.orgId, input.companyId);
    await assertOwnerInOrg(tx, ctx.orgId, input.ownerId);

    // D43: the same email-or-phone invariant Lead's updateLead already
    // guards (D35) — checked here, before the write, as a clean 422 rather
    // than relying on a database CHECK (Contact has none for this).
    const nextEmailNormalized = input.email !== undefined ? normalizeEmail(input.email) : existing.emailNormalized;
    const nextPhoneNormalized = input.phone !== undefined ? normalizePhone(input.phone) : existing.phoneNormalized;
    if (!nextEmailNormalized && !nextPhoneNormalized) {
      throw new ApiError(422, 'VALIDATION_FAILED', 'A contact needs an email or a phone number.', [
        { path: 'email', message: 'Provide an email or a phone number' },
      ]);
    }

    const data: Prisma.ContactUpdateInput = {
      // D98: the schema no longer accepts null, so a company can be changed but never removed.
      ...(input.companyId !== undefined ? { company: { connect: { id: input.companyId } } } : {}),
      ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
      ...(input.lastName !== undefined ? { lastName: blankToNull(input.lastName) } : {}),
      ...(input.email !== undefined
        ? { email: blankToNull(input.email), emailNormalized: normalizeEmail(input.email) }
        : {}),
      ...(input.phone !== undefined
        ? { phone: blankToNull(input.phone), phoneNormalized: normalizePhone(input.phone) }
        : {}),
      ...(input.jobTitle !== undefined ? { jobTitle: blankToNull(input.jobTitle) } : {}),
      ...(input.department !== undefined ? { department: blankToNull(input.department) } : {}),
      ...(input.location !== undefined ? { location: blankToNull(input.location) } : {}),
      ...(input.lifecycleStatus !== undefined
        ? { lifecycleStatus: input.lifecycleStatus || DEFAULT_LIFECYCLE_STATUS }
        : {}),
      ...(input.ownerId !== undefined ? { owner: input.ownerId ? { connect: { id: input.ownerId } } : { disconnect: true } } : {}),
      ...(input.notes !== undefined ? { notes: blankToNull(input.notes) } : {}),
    };

    const contact = await tx.contact.update({ where: { id: existing.id }, data });
    await writeAudit(tx, ctx, {
      action: 'contact.updated',
      entityType: 'contact',
      entityId: contact.id,
      metadata: { changedFields: Object.keys(input) },
    });
    return contact;
  });

  const duplicates =
    input.email !== undefined || input.phone !== undefined
      ? await findDuplicateContacts(
          ctx,
          { emailNormalized: updated.emailNormalized, phoneNormalized: updated.phoneNormalized },
          { excludeId: updated.id },
        )
      : [];
  return { contact: toContactResponse(updated), duplicates };
}

export async function archiveContact(ctx: RequestContext, id: string): Promise<ContactResponse> {
  const archived = await prisma.$transaction(async (tx) => {
    const existing = await tx.contact.findFirst({ where: { id, ...scoped(ctx) } });
    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', 'Contact not found');
    }
    if (existing.archivedAt) {
      throw new ApiError(409, 'ALREADY_ARCHIVED', 'This contact is already archived.');
    }
    const contact = await tx.contact.update({ where: { id: existing.id }, data: { archivedAt: new Date() } });
    await writeAudit(tx, ctx, { action: 'contact.archived', entityType: 'contact', entityId: contact.id });
    return contact;
  });
  return toContactResponse(archived);
}

export async function restoreContact(ctx: RequestContext, id: string): Promise<ContactResponse> {
  const restored = await prisma.$transaction(async (tx) => {
    const existing = await tx.contact.findFirst({ where: { id, ...scoped(ctx) } });
    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', 'Contact not found');
    }
    if (!existing.archivedAt) {
      throw new ApiError(409, 'NOT_ARCHIVED', 'This contact is not archived.');
    }
    const contact = await tx.contact.update({ where: { id: existing.id }, data: { archivedAt: null } });
    await writeAudit(tx, ctx, { action: 'contact.restored', entityType: 'contact', entityId: contact.id });
    return contact;
  });
  return toContactResponse(restored);
}
