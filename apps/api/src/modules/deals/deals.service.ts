import type {
  CreateDealInput,
  UpdateDealInput,
  MoveDealStageInput,
  CloseDealInput,
  SetDealContactsInput,
  ListDealsQuery,
  DealResponse,
  DealContactResponse,
} from '@growspark/shared';
import { prisma } from '../../db/prisma.js';
import { ApiError } from '../../middleware/error-handler.js';
import { scoped } from '../../lib/scoped.js';
import { writeAudit } from '../../lib/audit.js';
import { toSkipTake, buildPaginationMeta } from '../../lib/pagination.js';
import { buildOrderBy } from '../../lib/list-query.js';
import { getDefaultPipeline, getFirstOpenStage } from '../../lib/pipeline.js';
import type { RequestContext } from '../../lib/context.js';
import type { Deal, Prisma } from '../../generated/prisma/client.js';

function toDealResponse(deal: Deal): DealResponse {
  return {
    id: deal.id,
    name: deal.name,
    companyId: deal.companyId,
    pipelineId: deal.pipelineId,
    stageId: deal.stageId,
    value: deal.value.toString(),
    currency: deal.currency,
    probability: deal.probability,
    expectedCloseDate: deal.expectedCloseDate ? deal.expectedCloseDate.toISOString().slice(0, 10) : null,
    ownerId: deal.ownerId,
    dealType: deal.dealType,
    sourceId: deal.sourceId,
    status: deal.status,
    closedAt: deal.closedAt ? deal.closedAt.toISOString() : null,
    lostReason: deal.lostReason,
    lostNote: deal.lostNote,
    archivedAt: deal.archivedAt ? deal.archivedAt.toISOString() : null,
    createdAt: deal.createdAt.toISOString(),
    updatedAt: deal.updatedAt.toISOString(),
  };
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

async function assertCompanyInOrg(tx: Prisma.TransactionClient, organizationId: string, companyId: string): Promise<void> {
  const company = await tx.company.findFirst({ where: { id: companyId, organizationId } });
  if (!company) {
    throw new ApiError(404, 'NOT_FOUND', 'Company not found');
  }
}

async function assertSourceInOrg(
  tx: Prisma.TransactionClient,
  organizationId: string,
  sourceId: string | null | undefined,
): Promise<void> {
  if (!sourceId) return;
  const source = await tx.leadSource.findFirst({ where: { id: sourceId, organizationId } });
  if (!source) {
    throw new ApiError(404, 'NOT_FOUND', 'Lead source not found');
  }
}

/** Throws 409 unless the deal is still OPEN — every mutation except reopen/archive/restore requires this. */
function assertDealIsOpen(deal: Pick<Deal, 'status'>): void {
  if (deal.status !== 'OPEN') {
    throw new ApiError(409, 'CONFLICT', 'A closed deal is read-only — reopen it first.');
  }
}

export interface ListDealsResult {
  data: DealResponse[];
  meta: { page: number; pageSize: number; total: number };
}

export async function listDeals(ctx: RequestContext, query: ListDealsQuery): Promise<ListDealsResult> {
  const where: Prisma.DealWhereInput = {
    ...scoped(ctx),
    archivedAt: query.archived ? { not: null } : null,
    ...(query.status ? { status: query.status } : {}),
    ...(query.stageId ? { stageId: query.stageId } : {}),
    ...(query.companyId ? { companyId: query.companyId } : {}),
    ...(query.ownerId ? { ownerId: query.ownerId } : {}),
    ...(query.q ? { name: { contains: query.q, mode: 'insensitive' } } : {}),
  };

  const orderBy = buildOrderBy(query.sort, { field: 'createdAt', direction: 'desc' });

  const [rows, total] = await Promise.all([
    prisma.deal.findMany({ where, orderBy, ...toSkipTake(query) }),
    prisma.deal.count({ where }),
  ]);

  return { data: rows.map(toDealResponse), meta: buildPaginationMeta(query, total) };
}

export async function createDeal(ctx: RequestContext, input: CreateDealInput): Promise<DealResponse> {
  const created = await prisma.$transaction(async (tx) => {
    await assertCompanyInOrg(tx, ctx.orgId, input.companyId);
    await assertOwnerInOrg(tx, ctx.orgId, input.ownerId);
    await assertSourceInOrg(tx, ctx.orgId, input.sourceId);

    const pipeline = await getDefaultPipeline(tx, ctx.orgId);
    let stage;
    if (input.stageId) {
      stage = await tx.pipelineStage.findFirst({ where: { id: input.stageId, organizationId: ctx.orgId, pipelineId: pipeline.id } });
      if (!stage) {
        throw new ApiError(404, 'NOT_FOUND', 'Pipeline stage not found');
      }
      if (stage.type !== 'OPEN') {
        throw new ApiError(422, 'VALIDATION_FAILED', 'A deal can only be created in an open stage.', [
          { path: 'stageId', message: 'Must be an open stage' },
        ]);
      }
    } else {
      stage = await getFirstOpenStage(tx, ctx.orgId, pipeline.id);
    }

    const deal = await tx.deal.create({
      data: {
        organizationId: ctx.orgId,
        name: input.name,
        companyId: input.companyId,
        pipelineId: pipeline.id,
        stageId: stage.id,
        probability: input.probability ?? stage.probability,
        value: input.value ?? 0,
        expectedCloseDate: input.expectedCloseDate ? new Date(input.expectedCloseDate) : null,
        ownerId: input.ownerId ?? ctx.userId,
        dealType: input.dealType ?? null,
        sourceId: input.sourceId ?? null,
      },
    });
    await tx.dealStageHistory.create({
      data: { organizationId: ctx.orgId, dealId: deal.id, fromStageId: null, toStageId: stage.id, changedById: ctx.userId },
    });
    await writeAudit(tx, ctx, {
      action: 'deal.created',
      entityType: 'deal',
      entityId: deal.id,
      metadata: { name: deal.name, companyId: deal.companyId },
    });
    return deal;
  });
  return toDealResponse(created);
}

export async function getDeal(ctx: RequestContext, id: string): Promise<DealResponse> {
  const deal = await prisma.deal.findFirst({ where: { id, ...scoped(ctx) } });
  if (!deal) {
    throw new ApiError(404, 'NOT_FOUND', 'Deal not found');
  }
  return toDealResponse(deal);
}

export async function updateDeal(ctx: RequestContext, id: string, input: UpdateDealInput): Promise<DealResponse> {
  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.deal.findFirst({ where: { id, ...scoped(ctx) } });
    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', 'Deal not found');
    }
    assertDealIsOpen(existing);

    if (input.companyId !== undefined) await assertCompanyInOrg(tx, ctx.orgId, input.companyId);
    await assertOwnerInOrg(tx, ctx.orgId, input.ownerId);
    await assertSourceInOrg(tx, ctx.orgId, input.sourceId);

    const data: Prisma.DealUpdateInput = {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.companyId !== undefined ? { company: { connect: { id: input.companyId } } } : {}),
      ...(input.value !== undefined ? { value: input.value } : {}),
      ...(input.probability !== undefined ? { probability: input.probability } : {}),
      ...(input.expectedCloseDate !== undefined
        ? { expectedCloseDate: input.expectedCloseDate ? new Date(input.expectedCloseDate) : null }
        : {}),
      ...(input.ownerId !== undefined ? { owner: input.ownerId ? { connect: { id: input.ownerId } } : { disconnect: true } } : {}),
      ...(input.dealType !== undefined ? { dealType: input.dealType || null } : {}),
      ...(input.sourceId !== undefined ? { source: input.sourceId ? { connect: { id: input.sourceId } } : { disconnect: true } } : {}),
    };

    const deal = await tx.deal.update({ where: { id: existing.id }, data });
    await writeAudit(tx, ctx, {
      action: 'deal.updated',
      entityType: 'deal',
      entityId: deal.id,
      metadata: { changedFields: Object.keys(input) },
    });
    return deal;
  });
  return toDealResponse(updated);
}

export async function moveDealStage(ctx: RequestContext, id: string, input: MoveDealStageInput): Promise<DealResponse> {
  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.deal.findFirst({ where: { id, ...scoped(ctx) } });
    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', 'Deal not found');
    }
    assertDealIsOpen(existing);

    const stage = await tx.pipelineStage.findFirst({ where: { id: input.stageId, organizationId: ctx.orgId, pipelineId: existing.pipelineId } });
    if (!stage) {
      throw new ApiError(404, 'NOT_FOUND', 'Pipeline stage not found');
    }
    if (stage.type !== 'OPEN') {
      throw new ApiError(422, 'VALIDATION_FAILED', 'A deal can only be moved to an open stage — use close to mark it Won or Lost.', [
        { path: 'stageId', message: 'Must be an open stage' },
      ]);
    }

    // Roadmap D7: probability is copied from the stage on every stage
    // change (and can still be edited afterwards via PATCH).
    const deal = await tx.deal.update({
      where: { id: existing.id },
      data: { stageId: stage.id, probability: stage.probability },
    });
    await tx.dealStageHistory.create({
      data: {
        organizationId: ctx.orgId,
        dealId: deal.id,
        fromStageId: existing.stageId,
        toStageId: stage.id,
        changedById: ctx.userId,
      },
    });
    await writeAudit(tx, ctx, {
      action: 'deal.stage_changed',
      entityType: 'deal',
      entityId: deal.id,
      metadata: { fromStageId: existing.stageId, toStageId: stage.id },
    });
    return deal;
  });
  return toDealResponse(updated);
}

export async function closeDeal(ctx: RequestContext, id: string, input: CloseDealInput): Promise<DealResponse> {
  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.deal.findFirst({ where: { id, ...scoped(ctx) } });
    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', 'Deal not found');
    }
    assertDealIsOpen(existing);

    const closedStage = await tx.pipelineStage.findFirst({
      where: { organizationId: ctx.orgId, pipelineId: existing.pipelineId, type: input.status },
      orderBy: { position: 'asc' },
    });
    if (!closedStage) {
      throw new ApiError(500, 'INTERNAL', `No ${input.status} pipeline stage is configured for this organisation.`);
    }

    const deal = await tx.deal.update({
      where: { id: existing.id },
      data: {
        status: input.status,
        stageId: closedStage.id,
        probability: input.status === 'WON' ? 100 : 0,
        closedAt: new Date(),
        lostReason: input.status === 'LOST' ? (input.lostReason ?? null) : null,
        lostNote: input.status === 'LOST' ? (input.lostNote ?? null) : null,
      },
    });
    await tx.dealStageHistory.create({
      data: {
        organizationId: ctx.orgId,
        dealId: deal.id,
        fromStageId: existing.stageId,
        toStageId: closedStage.id,
        changedById: ctx.userId,
      },
    });
    await writeAudit(tx, ctx, {
      action: input.status === 'WON' ? 'deal.won' : 'deal.lost',
      entityType: 'deal',
      entityId: deal.id,
      metadata: { lostReason: deal.lostReason },
    });
    return deal;
  });
  return toDealResponse(updated);
}

export async function reopenDeal(ctx: RequestContext, id: string): Promise<DealResponse> {
  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.deal.findFirst({ where: { id, ...scoped(ctx) } });
    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', 'Deal not found');
    }
    if (existing.status === 'OPEN') {
      throw new ApiError(409, 'CONFLICT', 'This deal is already open.');
    }

    const firstStage = await getFirstOpenStage(tx, ctx.orgId, existing.pipelineId);
    const deal = await tx.deal.update({
      where: { id: existing.id },
      data: {
        status: 'OPEN',
        stageId: firstStage.id,
        probability: firstStage.probability,
        closedAt: null,
        lostReason: null,
        lostNote: null,
      },
    });
    await tx.dealStageHistory.create({
      data: {
        organizationId: ctx.orgId,
        dealId: deal.id,
        fromStageId: existing.stageId,
        toStageId: firstStage.id,
        changedById: ctx.userId,
      },
    });
    await writeAudit(tx, ctx, { action: 'deal.reopened', entityType: 'deal', entityId: deal.id });
    return deal;
  });
  return toDealResponse(updated);
}

export async function archiveDeal(ctx: RequestContext, id: string): Promise<DealResponse> {
  const archived = await prisma.$transaction(async (tx) => {
    const existing = await tx.deal.findFirst({ where: { id, ...scoped(ctx) } });
    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', 'Deal not found');
    }
    if (existing.archivedAt) {
      throw new ApiError(409, 'ALREADY_ARCHIVED', 'This deal is already archived.');
    }
    const deal = await tx.deal.update({ where: { id: existing.id }, data: { archivedAt: new Date() } });
    await writeAudit(tx, ctx, { action: 'deal.archived', entityType: 'deal', entityId: deal.id });
    return deal;
  });
  return toDealResponse(archived);
}

export async function restoreDeal(ctx: RequestContext, id: string): Promise<DealResponse> {
  const restored = await prisma.$transaction(async (tx) => {
    const existing = await tx.deal.findFirst({ where: { id, ...scoped(ctx) } });
    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', 'Deal not found');
    }
    if (!existing.archivedAt) {
      throw new ApiError(409, 'NOT_ARCHIVED', 'This deal is not archived.');
    }
    const deal = await tx.deal.update({ where: { id: existing.id }, data: { archivedAt: null } });
    await writeAudit(tx, ctx, { action: 'deal.restored', entityType: 'deal', entityId: deal.id });
    return deal;
  });
  return toDealResponse(restored);
}

export async function setDealContacts(
  ctx: RequestContext,
  id: string,
  input: SetDealContactsInput,
): Promise<DealContactResponse[]> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.deal.findFirst({ where: { id, ...scoped(ctx) } });
    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', 'Deal not found');
    }
    assertDealIsOpen(existing);

    if (input.contactIds.length > 0) {
      const contacts = await tx.contact.findMany({ where: { id: { in: input.contactIds }, organizationId: ctx.orgId } });
      if (contacts.length !== new Set(input.contactIds).size) {
        throw new ApiError(404, 'NOT_FOUND', 'One or more contacts were not found');
      }
    }

    const primaryContactId = input.primaryContactId ?? input.contactIds[0];

    await tx.dealContact.deleteMany({ where: { dealId: existing.id } });
    if (input.contactIds.length > 0) {
      await tx.dealContact.createMany({
        data: input.contactIds.map((contactId) => ({
          organizationId: ctx.orgId,
          dealId: existing.id,
          contactId,
          isPrimary: contactId === primaryContactId,
        })),
      });
    }
    await writeAudit(tx, ctx, {
      action: 'deal.contacts_updated',
      entityType: 'deal',
      entityId: existing.id,
      metadata: { contactIds: input.contactIds },
    });

    const rows = await tx.dealContact.findMany({ where: { dealId: existing.id } });
    return rows.map((row) => ({ contactId: row.contactId, isPrimary: row.isPrimary }));
  });
}
