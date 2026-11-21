import { normalizeEmail, normalizePhone, normalizeCompanyName } from '@growspark/shared';
import type {
  CreateLeadInput,
  UpdateLeadInput,
  UpdateLeadStatusInput,
  ListLeadsQuery,
  LeadDuplicateCheckQuery,
  LeadResponse,
  LeadStatusHistoryResponse,
  DuplicateMatch,
} from '@growspark/shared';
import { prisma } from '../../db/prisma.js';
import { Prisma as PrismaRuntime } from '../../generated/prisma/client.js';
import { ApiError } from '../../middleware/error-handler.js';
import { scoped } from '../../lib/scoped.js';
import { writeAudit } from '../../lib/audit.js';
import { toSkipTake, buildPaginationMeta } from '../../lib/pagination.js';
import { buildOrderBy } from '../../lib/list-query.js';
import { findDuplicateLeads } from '../../lib/duplicates.js';
import type { RequestContext } from '../../lib/context.js';
import type { Lead, Prisma } from '../../generated/prisma/client.js';

type LeadConversionSummary = { companyId: string; contactId: string; dealId: string | null } | null;

function toLeadResponse(lead: Lead, conversion: LeadConversionSummary = null): LeadResponse {
  return {
    id: lead.id,
    firstName: lead.firstName,
    lastName: lead.lastName,
    email: lead.email,
    phone: lead.phone,
    companyName: lead.companyName,
    website: lead.website,
    jobTitle: lead.jobTitle,
    industry: lead.industry,
    sourceId: lead.sourceId,
    sourceDetail: lead.sourceDetail,
    status: lead.status,
    priority: lead.priority,
    ownerId: lead.ownerId,
    requirement: lead.requirement,
    estimatedBudget: lead.estimatedBudget ? lead.estimatedBudget.toString() : null,
    purchaseTimeline: lead.purchaseTimeline,
    nextFollowUpAt: lead.nextFollowUpAt ? lead.nextFollowUpAt.toISOString() : null,
    notes: lead.notes,
    capturedFields: lead.capturedFields,
    convertedAt: lead.convertedAt ? lead.convertedAt.toISOString() : null,
    archivedAt: lead.archivedAt ? lead.archivedAt.toISOString() : null,
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
    conversion,
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

async function assertSourceInOrg(
  tx: Prisma.TransactionClient,
  organizationId: string,
  sourceId: string,
): Promise<void> {
  const source = await tx.leadSource.findFirst({ where: { id: sourceId, organizationId } });
  if (!source) {
    throw new ApiError(404, 'NOT_FOUND', 'Lead source not found');
  }
}

export interface ListLeadsResult {
  data: LeadResponse[];
  meta: { page: number; pageSize: number; total: number };
}

export async function listLeads(ctx: RequestContext, query: ListLeadsQuery): Promise<ListLeadsResult> {
  const where: Prisma.LeadWhereInput = {
    ...scoped(ctx),
    archivedAt: query.archived ? { not: null } : null,
    ...(query.status ? { status: query.status } : {}),
    ...(query.sourceId ? { sourceId: query.sourceId } : {}),
    ...(query.ownerId ? { ownerId: query.ownerId } : {}),
    ...(query.priority ? { priority: query.priority } : {}),
    ...(query.createdFrom || query.createdTo
      ? {
          createdAt: {
            ...(query.createdFrom ? { gte: new Date(query.createdFrom) } : {}),
            ...(query.createdTo ? { lte: new Date(query.createdTo) } : {}),
          },
        }
      : {}),
    ...(query.q
      ? {
          OR: [
            { firstName: { contains: query.q, mode: 'insensitive' } },
            { lastName: { contains: query.q, mode: 'insensitive' } },
            { email: { contains: query.q, mode: 'insensitive' } },
            { phone: { contains: query.q, mode: 'insensitive' } },
            { companyName: { contains: query.q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const orderBy = buildOrderBy(query.sort, { field: 'createdAt', direction: 'desc' });

  const [rows, total] = await Promise.all([
    prisma.lead.findMany({ where, orderBy, ...toSkipTake(query) }),
    prisma.lead.count({ where }),
  ]);

  return { data: rows.map((lead) => toLeadResponse(lead)), meta: buildPaginationMeta(query, total) };
}

export interface LeadMutationResult {
  lead: LeadResponse;
  duplicates: DuplicateMatch[];
}

export async function createLead(ctx: RequestContext, input: CreateLeadInput): Promise<LeadMutationResult> {
  const emailNormalized = normalizeEmail(input.email);
  const phoneNormalized = normalizePhone(input.phone);
  const companyNameNormalized = normalizeCompanyName(input.companyName);

  const created = await prisma.$transaction(async (tx) => {
    const sourceId = input.sourceId ?? (await tx.leadSource.findFirst({
      where: { organizationId: ctx.orgId, name: 'Manual' },
      select: { id: true },
    }))?.id;
    if (!sourceId) throw new ApiError(422, 'VALIDATION_FAILED', 'The Manual lead source is not configured.');
    await assertSourceInOrg(tx, ctx.orgId, sourceId);
    await assertOwnerInOrg(tx, ctx.orgId, input.ownerId);

    const lead = await tx.lead.create({
      data: {
        organizationId: ctx.orgId,
        firstName: input.firstName,
        lastName: input.lastName ?? null,
        email: input.email ?? null,
        emailNormalized,
        phone: input.phone ?? null,
        phoneNormalized,
        companyName: input.companyName ?? null,
        companyNameNormalized,
        website: input.website ?? null,
        jobTitle: input.jobTitle ?? null,
        industry: input.industry ?? null,
        sourceId,
        sourceDetail: input.sourceDetail ?? null,
        priority: input.priority ?? 'MEDIUM',
        ownerId: input.ownerId ?? null,
        requirement: input.requirement ?? null,
        estimatedBudget: input.estimatedBudget === undefined ? null : new PrismaRuntime.Decimal(input.estimatedBudget),
        purchaseTimeline: input.purchaseTimeline ?? null,
        nextFollowUpAt: input.nextFollowUpAt ? new Date(input.nextFollowUpAt) : null,
        notes: input.notes ?? null,
        ...(input.capturedFields !== undefined
          ? { capturedFields: input.capturedFields as Prisma.InputJsonValue }
          : {}),
      },
    });
    await writeAudit(tx, ctx, {
      action: 'lead.created',
      entityType: 'lead',
      entityId: lead.id,
      metadata: { firstName: lead.firstName, lastName: lead.lastName, sourceId: lead.sourceId },
    });
    return lead;
  });

  const duplicates = await findDuplicateLeads(
    ctx,
    { emailNormalized, phoneNormalized, companyNameNormalized },
    { excludeId: created.id },
  );
  return { lead: toLeadResponse(created), duplicates };
}

export async function getLead(ctx: RequestContext, id: string): Promise<LeadResponse> {
  const lead = await prisma.lead.findFirst({ where: { id, ...scoped(ctx) } });
  if (!lead) {
    throw new ApiError(404, 'NOT_FOUND', 'Lead not found');
  }
  // Package 3.5: only the detail endpoint pays for this extra lookup — a
  // non-converted lead simply has no LeadConversion row, so this is a
  // cheap miss for the common case, not a join every list row would carry.
  const conversion = await prisma.leadConversion.findUnique({
    where: { leadId: lead.id },
    select: { companyId: true, contactId: true, dealId: true },
  });
  return toLeadResponse(lead, conversion ?? null);
}

export async function updateLead(
  ctx: RequestContext,
  id: string,
  input: UpdateLeadInput,
): Promise<LeadMutationResult> {
  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.lead.findFirst({ where: { id, ...scoped(ctx) } });
    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', 'Lead not found');
    }

    if (input.sourceId !== undefined) {
      await assertSourceInOrg(tx, ctx.orgId, input.sourceId);
    }
    await assertOwnerInOrg(tx, ctx.orgId, input.ownerId);

    // Guard the has-email-or-phone invariant before it reaches the database's
    // own CHECK constraint — a violation there surfaces as an opaque P2039,
    // which the central error handler deliberately maps to a generic 500
    // (see error-handler.ts), not a clean client-facing 422. Checking here
    // instead keeps this a normal validation failure.
    const nextEmailNormalized = input.email !== undefined ? normalizeEmail(input.email) : existing.emailNormalized;
    const nextPhoneNormalized = input.phone !== undefined ? normalizePhone(input.phone) : existing.phoneNormalized;
    if (!nextEmailNormalized && !nextPhoneNormalized) {
      throw new ApiError(422, 'VALIDATION_FAILED', 'A lead needs an email or a phone number.', [
        { path: 'email', message: 'Provide an email or a phone number' },
      ]);
    }

    const data: Prisma.LeadUpdateInput = {
      ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
      ...(input.lastName !== undefined ? { lastName: blankToNull(input.lastName) } : {}),
      ...(input.email !== undefined
        ? { email: blankToNull(input.email), emailNormalized: normalizeEmail(input.email) }
        : {}),
      ...(input.phone !== undefined
        ? { phone: blankToNull(input.phone), phoneNormalized: normalizePhone(input.phone) }
        : {}),
      ...(input.companyName !== undefined
        ? { companyName: blankToNull(input.companyName), companyNameNormalized: normalizeCompanyName(input.companyName) }
        : {}),
      ...(input.website !== undefined ? { website: blankToNull(input.website) } : {}),
      ...(input.jobTitle !== undefined ? { jobTitle: blankToNull(input.jobTitle) } : {}),
      ...(input.industry !== undefined ? { industry: blankToNull(input.industry) } : {}),
      ...(input.sourceId !== undefined ? { source: { connect: { id: input.sourceId } } } : {}),
      ...(input.sourceDetail !== undefined ? { sourceDetail: blankToNull(input.sourceDetail) } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.ownerId !== undefined
        ? { owner: input.ownerId ? { connect: { id: input.ownerId } } : { disconnect: true } }
        : {}),
      ...(input.purchaseTimeline !== undefined ? { purchaseTimeline: blankToNull(input.purchaseTimeline) } : {}),
      ...(input.nextFollowUpAt !== undefined
        ? { nextFollowUpAt: input.nextFollowUpAt ? new Date(input.nextFollowUpAt) : null }
        : {}),
      ...(input.notes !== undefined ? { notes: blankToNull(input.notes) } : {}),
    };

    const lead = await tx.lead.update({ where: { id: existing.id }, data });
    await writeAudit(tx, ctx, {
      action: 'lead.updated',
      entityType: 'lead',
      entityId: lead.id,
      metadata: { changedFields: Object.keys(input) },
    });
    return lead;
  });

  const duplicates =
    input.email !== undefined || input.phone !== undefined || input.companyName !== undefined
      ? await findDuplicateLeads(
          ctx,
          {
            emailNormalized: updated.emailNormalized,
            phoneNormalized: updated.phoneNormalized,
            companyNameNormalized: updated.companyNameNormalized,
          },
          { excludeId: updated.id },
        )
      : [];
  return { lead: toLeadResponse(updated), duplicates };
}

/**
 * D29: any open status may move to any other open status directly;
 * CONVERTED is reachable only through the Day 3 convert action. The input
 * type (OpenLeadStatus) already excludes CONVERTED as a *target*; this also
 * refuses the change when the lead's *current* status is already CONVERTED
 * (the "from" direction the type system alone can't express).
 */
export async function updateLeadStatus(
  ctx: RequestContext,
  id: string,
  input: UpdateLeadStatusInput,
): Promise<LeadResponse> {
  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.lead.findFirst({ where: { id, ...scoped(ctx) } });
    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', 'Lead not found');
    }
    if (existing.status === 'CONVERTED') {
      throw new ApiError(409, 'CONFLICT', 'A converted lead cannot change status.');
    }

    const lead = await tx.lead.update({ where: { id: existing.id }, data: { status: input.status } });
    await tx.leadStatusHistory.create({
      data: {
        organizationId: ctx.orgId,
        leadId: lead.id,
        fromStatus: existing.status,
        toStatus: input.status,
        changedById: ctx.userId,
      },
    });
    await writeAudit(tx, ctx, {
      action: 'lead.status_changed',
      entityType: 'lead',
      entityId: lead.id,
      metadata: { fromStatus: existing.status, toStatus: input.status },
    });
    return lead;
  });

  return toLeadResponse(updated);
}

export async function archiveLead(ctx: RequestContext, id: string): Promise<LeadResponse> {
  const archived = await prisma.$transaction(async (tx) => {
    const existing = await tx.lead.findFirst({ where: { id, ...scoped(ctx) } });
    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', 'Lead not found');
    }
    if (existing.archivedAt) {
      throw new ApiError(409, 'ALREADY_ARCHIVED', 'This lead is already archived.');
    }
    const lead = await tx.lead.update({ where: { id: existing.id }, data: { archivedAt: new Date() } });
    await writeAudit(tx, ctx, { action: 'lead.archived', entityType: 'lead', entityId: lead.id });
    return lead;
  });
  return toLeadResponse(archived);
}

export async function restoreLead(ctx: RequestContext, id: string): Promise<LeadResponse> {
  const restored = await prisma.$transaction(async (tx) => {
    const existing = await tx.lead.findFirst({ where: { id, ...scoped(ctx) } });
    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', 'Lead not found');
    }
    if (!existing.archivedAt) {
      throw new ApiError(409, 'NOT_ARCHIVED', 'This lead is not archived.');
    }
    const lead = await tx.lead.update({ where: { id: existing.id }, data: { archivedAt: null } });
    await writeAudit(tx, ctx, { action: 'lead.restored', entityType: 'lead', entityId: lead.id });
    return lead;
  });
  return toLeadResponse(restored);
}

export async function checkLeadDuplicates(
  ctx: RequestContext,
  query: LeadDuplicateCheckQuery,
): Promise<DuplicateMatch[]> {
  return findDuplicateLeads(
    ctx,
    {
      emailNormalized: normalizeEmail(query.email),
      phoneNormalized: normalizePhone(query.phone),
      companyNameNormalized: normalizeCompanyName(query.companyName),
    },
    query.excludeId !== undefined ? { excludeId: query.excludeId } : {},
  );
}

export async function listLeadStatusHistory(
  ctx: RequestContext,
  leadId: string,
): Promise<LeadStatusHistoryResponse[]> {
  const lead = await prisma.lead.findFirst({ where: { id: leadId, ...scoped(ctx) } });
  if (!lead) {
    throw new ApiError(404, 'NOT_FOUND', 'Lead not found');
  }
  const rows = await prisma.leadStatusHistory.findMany({
    where: { ...scoped(ctx), leadId },
    orderBy: { createdAt: 'desc' },
    include: { changedBy: { select: { name: true } } },
  });
  return rows.map((row) => ({
    id: row.id,
    leadId: row.leadId,
    fromStatus: row.fromStatus,
    toStatus: row.toStatus,
    changedById: row.changedById,
    changedByName: row.changedBy.name,
    createdAt: row.createdAt.toISOString(),
  }));
}
