import type { ActivityResponse, CreateActivityInput, ListActivitiesQuery, TimelineEntry, UpdateActivityInput } from '@growspark/shared';
import { prisma } from '../../db/prisma.js';
import { ApiError } from '../../middleware/error-handler.js';
import { scoped } from '../../lib/scoped.js';
import { writeAudit } from '../../lib/audit.js';
import { toSkipTake, buildPaginationMeta } from '../../lib/pagination.js';
import { buildOrderBy } from '../../lib/list-query.js';
import { orgDayBounds } from '../../lib/org-time.js';
import type { RequestContext } from '../../lib/context.js';
import type { Activity, Prisma } from '../../generated/prisma/client.js';

function toResponse(activity: Activity): ActivityResponse {
  const iso = (value: Date | null) => value?.toISOString() ?? null;
  return {
    id: activity.id, type: activity.type, subject: activity.subject, description: activity.description,
    status: activity.status, priority: activity.priority, dueAt: iso(activity.dueAt),
    startAt: iso(activity.startAt), endAt: iso(activity.endAt), reminderAt: iso(activity.reminderAt),
    completedAt: iso(activity.completedAt), assigneeId: activity.assigneeId, createdById: activity.createdById,
    leadId: activity.leadId, contactId: activity.contactId, companyId: activity.companyId,
    dealId: activity.dealId, createdAt: activity.createdAt.toISOString(), updatedAt: activity.updatedAt.toISOString(),
  };
}

type Links = Pick<CreateActivityInput, 'leadId' | 'contactId' | 'companyId' | 'dealId'>;
async function assertLinks(tx: Prisma.TransactionClient, orgId: string, links: Links): Promise<string | null> {
  const checks = [
    ['lead', links.leadId], ['contact', links.contactId], ['company', links.companyId], ['deal', links.dealId],
  ] as const;
  let dealCompanyId: string | null = null;
  for (const [model, id] of checks) {
    if (!id) continue;
    if (model === 'deal') {
      const found = await tx.deal.findFirst({ where: { id, organizationId: orgId }, select: { companyId: true } });
      if (!found) throw new ApiError(404, 'NOT_FOUND', 'Linked record not found');
      dealCompanyId = found.companyId;
      continue;
    }
    const found = model === 'lead' ? await tx.lead.findFirst({ where: { id, organizationId: orgId }, select: { id: true } })
      : model === 'contact' ? await tx.contact.findFirst({ where: { id, organizationId: orgId }, select: { id: true } })
        : await tx.company.findFirst({ where: { id, organizationId: orgId }, select: { id: true } });
    if (!found) throw new ApiError(404, 'NOT_FOUND', 'Linked record not found');
  }
  return dealCompanyId;
}

function toDate(value: string | null | undefined): Date | null | undefined {
  return value === undefined ? undefined : value === null ? null : new Date(value);
}

export interface ActivitiesResult { data: ActivityResponse[]; meta: { page: number; pageSize: number; total: number } }
export async function listActivities(ctx: RequestContext, query: ListActivitiesQuery, now = new Date()): Promise<ActivitiesResult> {
  const predicates: Prisma.ActivityWhereInput[] = [];
  if (query.dueFrom || query.dueTo) {
    predicates.push({ dueAt: {
      ...(query.dueFrom ? { gte: new Date(query.dueFrom) } : {}),
      ...(query.dueTo ? { lte: new Date(query.dueTo) } : {}),
    } });
  }
  if (query.overdue) {
    const organization = await prisma.organization.findUnique({ where: { id: ctx.orgId }, select: { timezone: true } });
    if (!organization) throw new ApiError(404, 'NOT_FOUND', 'Organisation not found');
    predicates.push({
      status: 'OPEN',
      type: { in: ['TASK', 'CALL', 'MEETING'] },
      dueAt: { lt: orgDayBounds(now, organization.timezone).start },
    });
  }
  const where: Prisma.ActivityWhereInput = {
    ...scoped(ctx),
    ...(query.type ? { type: query.type } : {}), ...(query.status ? { status: query.status } : {}),
    ...(query.priority ? { priority: query.priority } : {}),
    ...(query.assigneeId ? { assigneeId: query.assigneeId } : {}),
    ...(query.leadId ? { leadId: query.leadId } : {}), ...(query.contactId ? { contactId: query.contactId } : {}),
    ...(query.companyId ? { companyId: query.companyId } : {}), ...(query.dealId ? { dealId: query.dealId } : {}),
    ...(predicates.length ? { AND: predicates } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.activity.findMany({ where, orderBy: buildOrderBy(query.sort, { field: 'createdAt', direction: 'desc' }), ...toSkipTake(query) }),
    prisma.activity.count({ where }),
  ]);
  return { data: rows.map(toResponse), meta: buildPaginationMeta(query, total) };
}

export async function createActivity(ctx: RequestContext, input: CreateActivityInput): Promise<ActivityResponse> {
  const created = await prisma.$transaction(async (tx) => {
    const dealCompanyId = await assertLinks(tx, ctx.orgId, input);
    if (input.assigneeId) {
      const user = await tx.user.findFirst({ where: { id: input.assigneeId, organizationId: ctx.orgId } });
      if (!user) throw new ApiError(404, 'NOT_FOUND', 'Assignee not found');
    }
    const completed = input.type === 'NOTE';
    const row = await tx.activity.create({ data: {
      organizationId: ctx.orgId, type: input.type, subject: input.subject,
      description: input.description ?? null, status: completed ? 'DONE' : 'OPEN',
      priority: input.priority ?? 'MEDIUM', dueAt: toDate(input.dueAt) ?? null,
      startAt: toDate(input.startAt) ?? null, endAt: toDate(input.endAt) ?? null,
      reminderAt: toDate(input.reminderAt) ?? null, completedAt: completed ? new Date() : null,
      assigneeId: input.assigneeId ?? ctx.userId, createdById: ctx.userId,
      leadId: input.leadId ?? null, contactId: input.contactId ?? null,
      companyId: dealCompanyId ?? input.companyId ?? null, dealId: input.dealId ?? null,
    } });
    await writeAudit(tx, ctx, { action: 'activity.created', entityType: 'activity', entityId: row.id, metadata: { type: row.type } });
    return row;
  });
  return toResponse(created);
}

export async function getActivity(ctx: RequestContext, id: string): Promise<ActivityResponse> {
  const row = await prisma.activity.findFirst({ where: { id, ...scoped(ctx) } });
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Activity not found');
  return toResponse(row);
}

export async function updateActivity(ctx: RequestContext, id: string, input: UpdateActivityInput): Promise<ActivityResponse> {
  const row = await prisma.$transaction(async (tx) => {
    const existing = await tx.activity.findFirst({ where: { id, ...scoped(ctx) } });
    if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Activity not found');
    if (existing.status !== 'OPEN') throw new ApiError(409, 'CONFLICT', 'Only open activities can be edited');
    const links = {
      leadId: input.leadId === undefined ? existing.leadId : input.leadId,
      contactId: input.contactId === undefined ? existing.contactId : input.contactId,
      companyId: input.companyId === undefined ? existing.companyId : input.companyId,
      dealId: input.dealId === undefined ? existing.dealId : input.dealId,
    };
    if (!links.leadId && !links.contactId && !links.companyId && !links.dealId) {
      throw new ApiError(422, 'VALIDATION_FAILED', 'Link this activity to at least one CRM record.');
    }
    const dealCompanyId = await assertLinks(tx, ctx.orgId, links);
    if (input.assigneeId) {
      const user = await tx.user.findFirst({ where: { id: input.assigneeId, organizationId: ctx.orgId } });
      if (!user) throw new ApiError(404, 'NOT_FOUND', 'Assignee not found');
    }
    const data: Prisma.ActivityUpdateInput = {
      ...(input.type !== undefined ? { type: input.type } : {}), ...(input.subject !== undefined ? { subject: input.subject } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}), ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.dueAt !== undefined ? { dueAt: input.dueAt ? new Date(input.dueAt) : null } : {}),
      ...(input.startAt !== undefined ? { startAt: input.startAt ? new Date(input.startAt) : null } : {}),
      ...(input.endAt !== undefined ? { endAt: input.endAt ? new Date(input.endAt) : null } : {}),
      ...(input.reminderAt !== undefined ? { reminderAt: input.reminderAt ? new Date(input.reminderAt) : null } : {}),
      ...(input.assigneeId !== undefined ? { assignee: input.assigneeId ? { connect: { id: input.assigneeId } } : { disconnect: true } } : {}),
      ...(input.leadId !== undefined ? { lead: input.leadId ? { connect: { id: input.leadId } } : { disconnect: true } } : {}),
      ...(input.contactId !== undefined ? { contact: input.contactId ? { connect: { id: input.contactId } } : { disconnect: true } } : {}),
      ...(input.companyId !== undefined || input.dealId !== undefined ? {
        company: dealCompanyId || links.companyId ? { connect: { id: dealCompanyId ?? links.companyId! } } : { disconnect: true },
      } : {}),
      ...(input.dealId !== undefined ? { deal: input.dealId ? { connect: { id: input.dealId } } : { disconnect: true } } : {}),
    };
    const updated = await tx.activity.update({ where: { id }, data });
    await writeAudit(tx, ctx, { action: 'activity.updated', entityType: 'activity', entityId: id, metadata: { changedFields: Object.keys(input) } });
    return updated;
  });
  return toResponse(row);
}

async function setActivityStatus(ctx: RequestContext, id: string, status: 'DONE' | 'CANCELLED'): Promise<ActivityResponse> {
  const row = await prisma.$transaction(async (tx) => {
    const existing = await tx.activity.findFirst({ where: { id, ...scoped(ctx) } });
    if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Activity not found');
    if (existing.status !== 'OPEN') throw new ApiError(409, 'CONFLICT', 'Completed or cancelled activities cannot change status again');
    const updated = await tx.activity.update({ where: { id }, data: { status, completedAt: status === 'DONE' ? new Date() : null } });
    await writeAudit(tx, ctx, { action: status === 'DONE' ? 'activity.completed' : 'activity.cancelled', entityType: 'activity', entityId: id });
    return updated;
  });
  return toResponse(row);
}
export const completeActivity = (ctx: RequestContext, id: string) => setActivityStatus(ctx, id, 'DONE');
export const cancelActivity = (ctx: RequestContext, id: string) => setActivityStatus(ctx, id, 'CANCELLED');

export type TimelineOwner = 'lead' | 'contact' | 'company' | 'deal';
export async function getTimeline(ctx: RequestContext, owner: TimelineOwner, id: string, page: number, pageSize: number) {
  const where = { id, ...scoped(ctx) };
  const found = owner === 'lead' ? await prisma.lead.findFirst({ where, select: { id: true } })
    : owner === 'contact' ? await prisma.contact.findFirst({ where, select: { id: true } })
      : owner === 'company' ? await prisma.company.findFirst({ where, select: { id: true } })
        : await prisma.deal.findFirst({ where, select: { id: true } });
  if (!found) throw new ApiError(404, 'NOT_FOUND', 'Record not found');
  const link = { [`${owner}Id`]: id };
  const linkedDealIds = owner === 'contact'
    ? (await prisma.dealContact.findMany({ where: { organizationId: ctx.orgId, contactId: id }, select: { dealId: true } })).map((item) => item.dealId)
    : [];
  const activityWhere: Prisma.ActivityWhereInput = owner === 'contact'
    ? { ...scoped(ctx), OR: [{ contactId: id }, ...(linkedDealIds.length ? [{ dealId: { in: linkedDealIds } }] : [])] }
    : { ...scoped(ctx), ...link };
  const activities = await prisma.activity.findMany({ where: activityWhere, orderBy: { createdAt: 'desc' } });
  const completionEvents = activities.length ? await prisma.auditEvent.findMany({
    where: { ...scoped(ctx), entityType: 'activity', action: 'activity.completed', entityId: { in: activities.map((activity) => activity.id) } },
    include: { actor: { select: { name: true } } },
  }) : [];
  const completedByActivity = new Map(completionEvents.map((event) => [event.entityId, event.actor?.name ?? null]));
  const entries: TimelineEntry[] = activities.map((a) => ({
    id: a.id, kind: 'ACTIVITY', at: a.createdAt.toISOString(), title: `${a.type}: ${a.subject}`, description: a.description, actorId: a.createdById,
    status: a.status, completedAt: a.completedAt?.toISOString() ?? null,
    completedByName: a.status === 'DONE' ? completedByActivity.get(a.id) ?? null : null,
  }));
  if (owner === 'lead') {
    const [history, conversion] = await Promise.all([
      prisma.leadStatusHistory.findMany({ where: { ...scoped(ctx), leadId: id }, include: { changedBy: { select: { name: true } } } }),
      prisma.leadConversion.findFirst({ where: { ...scoped(ctx), leadId: id } }),
    ]);
    entries.push(...history.map((h) => ({ id: h.id, kind: 'LEAD_STATUS' as const, at: h.createdAt.toISOString(), title: `${h.fromStatus ?? 'Created'} → ${h.toStatus}`, description: `By ${h.changedBy.name}`, actorId: h.changedById })));
    if (conversion) entries.push({ id: conversion.id, kind: 'CONVERSION', at: conversion.createdAt.toISOString(), title: 'Lead converted', description: null, actorId: conversion.convertedById });
  }
  if (owner === 'deal') {
    const history = await prisma.dealStageHistory.findMany({ where: { ...scoped(ctx), dealId: id }, include: { fromStage: { select: { name: true } }, toStage: { select: { name: true } } } });
    entries.push(...history.map((h) => ({ id: h.id, kind: 'DEAL_STAGE' as const, at: h.createdAt.toISOString(), title: `${h.fromStage?.name ?? 'Created'} → ${h.toStage.name}`, description: null, actorId: h.changedById })));
  }
  entries.sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id));
  const total = entries.length;
  const nextActivity = await prisma.activity.findFirst({
    where: { ...activityWhere, status: 'OPEN', type: { in: ['TASK', 'CALL', 'MEETING'] } },
    orderBy: [{ dueAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }],
  });
  return {
    data: entries.slice((page - 1) * pageSize, page * pageSize), meta: { page, pageSize, total },
    nextActivity: nextActivity ? toResponse(nextActivity) : null,
  };
}
