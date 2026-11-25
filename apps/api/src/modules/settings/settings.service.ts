import {
  isLockedLeadSourceName,
  type CreateLeadSourceInput,
  type CreatePipelineStageInput,
  type OrganizationResponse,
  type ReorderInput,
  type SettingsLeadSourceResponse,
  type SettingsPipelineStageResponse,
  type UpdateLeadSourceInput,
  type UpdateOrganizationInput,
  type UpdatePipelineStageInput,
} from '@growspark/shared';
import { prisma } from '../../db/prisma.js';
import { Prisma, type Organization } from '../../generated/prisma/client.js';
import { ApiError } from '../../middleware/error-handler.js';
import { writeAudit } from '../../lib/audit.js';
import { scoped } from '../../lib/scoped.js';
import { getDefaultPipeline } from '../../lib/pipeline.js';
import { isKnownRequestError } from '../../lib/prisma-errors.js';
import type { RequestContext } from '../../lib/context.js';

/** Settings (D93). Every function here is reached only through a settings:manage route. */

// ---------------------------------------------------------------------------
// Organisation profile
// ---------------------------------------------------------------------------

const ORGANIZATION_EDITABLE_FIELDS = [
  'name',
  'legalName',
  'addressLine1',
  'addressLine2',
  'city',
  'state',
  'postalCode',
  'country',
  'phone',
  'email',
  'website',
  'gstin',
] as const satisfies readonly (keyof UpdateOrganizationInput)[];

function toOrganizationResponse(org: Organization): OrganizationResponse {
  return {
    id: org.id,
    name: org.name,
    timezone: org.timezone,
    currency: org.currency,
    legalName: org.legalName,
    addressLine1: org.addressLine1,
    addressLine2: org.addressLine2,
    city: org.city,
    state: org.state,
    postalCode: org.postalCode,
    country: org.country,
    phone: org.phone,
    email: org.email,
    website: org.website,
    gstin: org.gstin,
  };
}

export async function getOrganization(ctx: RequestContext): Promise<OrganizationResponse> {
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: ctx.orgId } });
  return toOrganizationResponse(org);
}

/**
 * Writes only the fields whose value actually changes, and audits their
 * names (never their values — an address or phone is not audit material).
 * Saving an unchanged form writes nothing and no audit row.
 */
export async function updateOrganization(
  ctx: RequestContext,
  input: UpdateOrganizationInput,
): Promise<OrganizationResponse> {
  const org = await prisma.$transaction(async (tx) => {
    const existing = await tx.organization.findUniqueOrThrow({ where: { id: ctx.orgId } });
    const data: Prisma.OrganizationUpdateInput = {};
    const changedFields: string[] = [];
    for (const field of ORGANIZATION_EDITABLE_FIELDS) {
      const next = input[field];
      if (next === undefined) continue;
      if (field === 'name') {
        if (next !== existing.name && next !== null) {
          data.name = next;
          changedFields.push(field);
        }
        continue;
      }
      if ((next ?? null) !== existing[field]) {
        data[field] = next ?? null;
        changedFields.push(field);
      }
    }
    if (changedFields.length === 0) return existing;

    const updated = await tx.organization.update({ where: { id: ctx.orgId }, data });
    await writeAudit(tx, ctx, {
      action: 'organization.details_updated',
      entityType: 'organization',
      entityId: ctx.orgId,
      metadata: { changedFields },
    });
    return updated;
  });
  return toOrganizationResponse(org);
}

// ---------------------------------------------------------------------------
// Lead sources
// ---------------------------------------------------------------------------

async function loadLeadSourceResponses(ctx: RequestContext, ids?: string[]): Promise<SettingsLeadSourceResponse[]> {
  const rows = await prisma.leadSource.findMany({
    where: { ...scoped(ctx), ...(ids ? { id: { in: ids } } : {}) },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { leads: true } } },
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
    locked: isLockedLeadSourceName(row.name),
    leadCount: row._count.leads,
  }));
}

async function loadLeadSourceResponse(ctx: RequestContext, id: string): Promise<SettingsLeadSourceResponse> {
  const [row] = await loadLeadSourceResponses(ctx, [id]);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Lead source not found');
  return row;
}

/** Every source, active or not — the dropdown endpoint (GET /lead-sources) keeps returning active ones only. */
export function listLeadSources(ctx: RequestContext): Promise<SettingsLeadSourceResponse[]> {
  return loadLeadSourceResponses(ctx);
}

/**
 * Serialises every structural settings change for one organisation (adding,
 * reordering, deleting) so two Admins editing at once cannot interleave a
 * read-then-renumber. The organisation row is a convenient per-tenant lock.
 */
async function lockOrganizationSettings(tx: Prisma.TransactionClient, ctx: RequestContext): Promise<void> {
  await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${ctx.orgId}::uuid FOR UPDATE`;
}

/** Names are unique per organisation ignoring case: "referral" next to "Referral" is a mistake, not a new source. */
async function assertLeadSourceNameFree(
  tx: Prisma.TransactionClient,
  ctx: RequestContext,
  name: string,
  exceptId?: string,
): Promise<void> {
  const clash = await tx.leadSource.findFirst({
    where: { ...scoped(ctx), name: { equals: name, mode: 'insensitive' }, ...(exceptId ? { id: { not: exceptId } } : {}) },
  });
  if (clash) {
    throw new ApiError(409, 'CONFLICT', `A lead source called "${clash.name}" already exists.`);
  }
}

function rethrowUniqueAsConflict(err: unknown, message: string): never {
  if (isKnownRequestError(err) && err.code === 'P2002') {
    throw new ApiError(409, 'CONFLICT', message);
  }
  throw err;
}

export async function createLeadSource(ctx: RequestContext, input: CreateLeadSourceInput): Promise<SettingsLeadSourceResponse> {
  let id: string;
  try {
    id = await prisma.$transaction(async (tx) => {
      await lockOrganizationSettings(tx, ctx);
      await assertLeadSourceNameFree(tx, ctx, input.name);
      const last = await tx.leadSource.aggregate({ where: scoped(ctx), _max: { sortOrder: true } });
      const source = await tx.leadSource.create({
        data: { organizationId: ctx.orgId, name: input.name, sortOrder: (last._max.sortOrder ?? 0) + 1 },
      });
      await writeAudit(tx, ctx, {
        action: 'lead_source.created',
        entityType: 'lead_source',
        entityId: source.id,
        metadata: { name: source.name },
      });
      return source.id;
    });
  } catch (err) {
    rethrowUniqueAsConflict(err, 'A lead source with this name already exists.');
  }
  return loadLeadSourceResponse(ctx, id);
}

export async function updateLeadSource(
  ctx: RequestContext,
  id: string,
  input: UpdateLeadSourceInput,
): Promise<SettingsLeadSourceResponse> {
  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.leadSource.findFirst({ where: { id, ...scoped(ctx) } });
      if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Lead source not found');

      const renaming = input.name !== undefined && input.name !== existing.name;
      const togglingActive = input.isActive !== undefined && input.isActive !== existing.isActive;
      if (!renaming && !togglingActive) return;

      if (isLockedLeadSourceName(existing.name)) {
        throw new ApiError(
          409,
          'LOCKED',
          `"${existing.name}" is used by the application itself and cannot be renamed or deactivated.`,
        );
      }
      if (renaming) {
        await assertLeadSourceNameFree(tx, ctx, input.name!, id);
        if (isLockedLeadSourceName(input.name!)) {
          throw new ApiError(409, 'CONFLICT', `"${input.name}" is a reserved source name.`);
        }
      }

      await tx.leadSource.update({
        where: { id },
        data: {
          ...(renaming ? { name: input.name! } : {}),
          ...(togglingActive ? { isActive: input.isActive! } : {}),
        },
      });
      const changedFields = [...(renaming ? ['name'] : []), ...(togglingActive ? ['isActive'] : [])];
      await writeAudit(tx, ctx, {
        action: togglingActive && !renaming
          ? input.isActive ? 'lead_source.reactivated' : 'lead_source.deactivated'
          : 'lead_source.updated',
        entityType: 'lead_source',
        entityId: id,
        metadata: {
          changedFields,
          ...(renaming ? { oldName: existing.name, newName: input.name } : { name: existing.name }),
        },
      });
    });
  } catch (err) {
    rethrowUniqueAsConflict(err, 'A lead source with this name already exists.');
  }
  return loadLeadSourceResponse(ctx, id);
}

/** `ids` must be exactly the organisation's sources (every one, once). */
export async function reorderLeadSources(ctx: RequestContext, input: ReorderInput): Promise<SettingsLeadSourceResponse[]> {
  await prisma.$transaction(async (tx) => {
    await lockOrganizationSettings(tx, ctx);
    const existing = await tx.leadSource.findMany({ where: scoped(ctx), select: { id: true } });
    assertSameIdSet(existing.map((row) => row.id), input.ids, 'lead source');
    for (const [index, sourceId] of input.ids.entries()) {
      await tx.leadSource.update({ where: { id: sourceId }, data: { sortOrder: index + 1 } });
    }
    await writeAudit(tx, ctx, { action: 'lead_source.reordered', entityType: 'lead_source' });
  });
  return loadLeadSourceResponses(ctx);
}

function assertSameIdSet(actual: string[], requested: string[], label: string): void {
  const actualSet = new Set(actual);
  const sameSet = actual.length === requested.length && requested.every((id) => actualSet.has(id));
  if (!sameSet) {
    throw new ApiError(422, 'VALIDATION_FAILED', `The new order must list every ${label} exactly once.`);
  }
}

// ---------------------------------------------------------------------------
// Pipeline stages
// ---------------------------------------------------------------------------

/**
 * Positions are 1..n with every OPEN stage first, then WON, then LOST — the
 * order the board and the "first open stage" rule (new and reopened deals)
 * already rely on. Changing the first open stage changes where new deals
 * start; that is the intended effect of reordering.
 */
async function loadStageResponses(ctx: RequestContext, db: Prisma.TransactionClient | typeof prisma = prisma): Promise<SettingsPipelineStageResponse[]> {
  const pipeline = await getDefaultPipeline(db, ctx.orgId);
  const stages = await db.pipelineStage.findMany({
    where: { organizationId: ctx.orgId, pipelineId: pipeline.id },
    orderBy: { position: 'asc' },
    include: { _count: { select: { deals: true, dealStageHistoryFrom: true, dealStageHistoryTo: true } } },
  });
  return stages.map((stage) => ({
    id: stage.id,
    name: stage.name,
    position: stage.position,
    probability: stage.probability,
    type: stage.type,
    dealCount: stage._count.deals,
    deletable:
      stage.type === 'OPEN' &&
      stage._count.deals === 0 &&
      stage._count.dealStageHistoryFrom === 0 &&
      stage._count.dealStageHistoryTo === 0,
  }));
}

export function listPipelineStages(ctx: RequestContext): Promise<SettingsPipelineStageResponse[]> {
  return loadStageResponses(ctx);
}

async function findStageOrThrow(ctx: RequestContext, db: Prisma.TransactionClient, id: string) {
  const pipeline = await getDefaultPipeline(db, ctx.orgId);
  const stage = await db.pipelineStage.findFirst({ where: { id, organizationId: ctx.orgId, pipelineId: pipeline.id } });
  if (!stage) throw new ApiError(404, 'NOT_FOUND', 'Pipeline stage not found');
  return { pipeline, stage };
}

async function assertStageNameFree(
  tx: Prisma.TransactionClient,
  ctx: RequestContext,
  pipelineId: string,
  name: string,
  exceptId?: string,
): Promise<void> {
  const clash = await tx.pipelineStage.findFirst({
    where: {
      organizationId: ctx.orgId,
      pipelineId,
      name: { equals: name, mode: 'insensitive' },
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
  });
  if (clash) throw new ApiError(409, 'CONFLICT', `A stage called "${clash.name}" already exists.`);
}

/**
 * Rewrites every stage's position to match `orderedIds` (1..n). The
 * (organization, pipeline, position) unique index is not deferrable, so the
 * rows are first moved out of the way (position + 10000) in one statement,
 * then written to their final positions.
 */
async function renumberStages(tx: Prisma.TransactionClient, ctx: RequestContext, pipelineId: string, orderedIds: string[]): Promise<void> {
  await tx.$executeRaw`
    UPDATE pipeline_stages SET position = position + 10000
    WHERE organization_id = ${ctx.orgId}::uuid AND pipeline_id = ${pipelineId}::uuid
  `;
  for (const [index, stageId] of orderedIds.entries()) {
    await tx.pipelineStage.update({ where: { id: stageId }, data: { position: index + 1 } });
  }
}

/** Current stage ids in board order: OPEN (by position), then WON, then LOST. */
async function orderedStageIds(tx: Prisma.TransactionClient, ctx: RequestContext, pipelineId: string) {
  const stages = await tx.pipelineStage.findMany({
    where: { organizationId: ctx.orgId, pipelineId },
    orderBy: { position: 'asc' },
    select: { id: true, type: true },
  });
  return {
    open: stages.filter((stage) => stage.type === 'OPEN').map((stage) => stage.id),
    closed: [
      ...stages.filter((stage) => stage.type === 'WON').map((stage) => stage.id),
      ...stages.filter((stage) => stage.type === 'LOST').map((stage) => stage.id),
    ],
  };
}

export async function createPipelineStage(
  ctx: RequestContext,
  input: CreatePipelineStageInput,
): Promise<SettingsPipelineStageResponse[]> {
  try {
    await prisma.$transaction(async (tx) => {
      await lockOrganizationSettings(tx, ctx);
      const pipeline = await getDefaultPipeline(tx, ctx.orgId);
      await assertStageNameFree(tx, ctx, pipeline.id, input.name);
      const { open, closed } = await orderedStageIds(tx, ctx, pipeline.id);
      // Created at a temporary out-of-range position, then everything is renumbered with it as the last open stage.
      const stage = await tx.pipelineStage.create({
        data: {
          organizationId: ctx.orgId,
          pipelineId: pipeline.id,
          name: input.name,
          probability: input.probability,
          type: 'OPEN',
          position: 20000,
        },
      });
      await renumberStages(tx, ctx, pipeline.id, [...open, stage.id, ...closed]);
      await writeAudit(tx, ctx, {
        action: 'pipeline_stage.created',
        entityType: 'pipeline_stage',
        entityId: stage.id,
        metadata: { name: stage.name },
      });
    });
  } catch (err) {
    rethrowUniqueAsConflict(err, 'A stage with this name already exists.');
  }
  return loadStageResponses(ctx);
}

/**
 * Probability changes do NOT rewrite existing deals: a deal copies its
 * stage's probability when it enters the stage (D7/D47), so its own figure
 * stays what it was. Won (100) and Lost (0) probabilities are fixed.
 */
export async function updatePipelineStage(
  ctx: RequestContext,
  id: string,
  input: UpdatePipelineStageInput,
): Promise<SettingsPipelineStageResponse[]> {
  try {
    await prisma.$transaction(async (tx) => {
      const { pipeline, stage } = await findStageOrThrow(ctx, tx, id);
      if (input.probability !== undefined && stage.type !== 'OPEN' && input.probability !== stage.probability) {
        throw new ApiError(
          422,
          'VALIDATION_FAILED',
          'The probability of the Won and Lost stages is fixed.',
          [{ path: 'probability', message: 'Won is always 100% and Lost always 0%.' }],
        );
      }
      const renaming = input.name !== undefined && input.name !== stage.name;
      const reprobing = input.probability !== undefined && input.probability !== stage.probability;
      if (!renaming && !reprobing) return;
      if (renaming) await assertStageNameFree(tx, ctx, pipeline.id, input.name!, id);

      await tx.pipelineStage.update({
        where: { id },
        data: { ...(renaming ? { name: input.name! } : {}), ...(reprobing ? { probability: input.probability! } : {}) },
      });
      await writeAudit(tx, ctx, {
        action: 'pipeline_stage.updated',
        entityType: 'pipeline_stage',
        entityId: id,
        metadata: {
          changedFields: [...(renaming ? ['name'] : []), ...(reprobing ? ['probability'] : [])],
          ...(renaming ? { oldName: stage.name, newName: input.name } : { name: stage.name }),
        },
      });
    });
  } catch (err) {
    rethrowUniqueAsConflict(err, 'A stage with this name already exists.');
  }
  return loadStageResponses(ctx);
}

/** `ids` must be exactly the OPEN stages; Won and Lost always stay last. */
export async function reorderPipelineStages(ctx: RequestContext, input: ReorderInput): Promise<SettingsPipelineStageResponse[]> {
  await prisma.$transaction(async (tx) => {
    await lockOrganizationSettings(tx, ctx);
    const pipeline = await getDefaultPipeline(tx, ctx.orgId);
    const { open, closed } = await orderedStageIds(tx, ctx, pipeline.id);
    assertSameIdSet(open, input.ids, 'open stage');
    await renumberStages(tx, ctx, pipeline.id, [...input.ids, ...closed]);
    await writeAudit(tx, ctx, { action: 'pipeline_stage.reordered', entityType: 'pipeline_stage' });
  });
  return loadStageResponses(ctx);
}

/**
 * Only a never-used OPEN stage can be deleted: no deal (archived included)
 * and no stage-history row may reference it, so no record's past ever
 * points at a missing stage. At least one open stage must remain.
 */
export async function deletePipelineStage(ctx: RequestContext, id: string): Promise<SettingsPipelineStageResponse[]> {
  await prisma.$transaction(async (tx) => {
    await lockOrganizationSettings(tx, ctx);
    const { pipeline, stage } = await findStageOrThrow(ctx, tx, id);
    if (stage.type !== 'OPEN') {
      throw new ApiError(409, 'STAGE_IN_USE', 'The Won and Lost stages cannot be deleted.');
    }
    // Sequential on purpose: one transaction = one pg connection (D83).
    const deals = await tx.deal.count({ where: { organizationId: ctx.orgId, stageId: id } });
    const historyFrom = await tx.dealStageHistory.count({ where: { organizationId: ctx.orgId, fromStageId: id } });
    const historyTo = await tx.dealStageHistory.count({ where: { organizationId: ctx.orgId, toStageId: id } });
    const openCount = await tx.pipelineStage.count({ where: { organizationId: ctx.orgId, pipelineId: pipeline.id, type: 'OPEN' } });
    if (deals > 0 || historyFrom > 0 || historyTo > 0) {
      throw new ApiError(
        409,
        'STAGE_IN_USE',
        `"${stage.name}" has been used by ${deals > 0 ? `${deals} deal(s)` : 'deals in the past'} and cannot be deleted. Rename it instead.`,
      );
    }
    if (openCount <= 1) {
      throw new ApiError(409, 'STAGE_IN_USE', 'The pipeline needs at least one open stage.');
    }
    await tx.pipelineStage.delete({ where: { id } });
    const { open, closed } = await orderedStageIds(tx, ctx, pipeline.id);
    await renumberStages(tx, ctx, pipeline.id, [...open, ...closed]);
    await writeAudit(tx, ctx, {
      action: 'pipeline_stage.deleted',
      entityType: 'pipeline_stage',
      entityId: id,
      metadata: { name: stage.name },
    });
  });
  return loadStageResponses(ctx);
}
