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

export async function listContacts(
  ctx: RequestContext,
  query: ListContactsQuery,
): Promise<ListContactsResult> {
  const where: Prisma.ContactWhereInput = {
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

  const orderBy = buildOrderBy(query.sort, { field: 'createdAt', direction: 'desc' });

  const [rows, total] = await Promise.all([
    prisma.contact.findMany({ where, orderBy, ...toSkipTake(query) }),
    prisma.contact.count({ where }),
  ]);

  return { data: rows.map(toContactResponse), meta: buildPaginationMeta(query, total) };
}

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
        companyId: input.companyId ?? null,
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

    const data: Prisma.ContactUpdateInput = {
      ...(input.companyId !== undefined
        ? { company: input.companyId ? { connect: { id: input.companyId } } : { disconnect: true } }
        : {}),
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
    const existing = await tx.contact.findFirst({ where: { id, ...scoped(ctx), archivedAt: null } });
    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', 'Contact not found');
    }
    const contact = await tx.contact.update({ where: { id: existing.id }, data: { archivedAt: new Date() } });
    await writeAudit(tx, ctx, { action: 'contact.archived', entityType: 'contact', entityId: contact.id });
    return contact;
  });
  return toContactResponse(archived);
}

export async function restoreContact(ctx: RequestContext, id: string): Promise<ContactResponse> {
  const restored = await prisma.$transaction(async (tx) => {
    const existing = await tx.contact.findFirst({
      where: { id, ...scoped(ctx), archivedAt: { not: null } },
    });
    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', 'Contact not found');
    }
    const contact = await tx.contact.update({ where: { id: existing.id }, data: { archivedAt: null } });
    await writeAudit(tx, ctx, { action: 'contact.restored', entityType: 'contact', entityId: contact.id });
    return contact;
  });
  return toContactResponse(restored);
}
