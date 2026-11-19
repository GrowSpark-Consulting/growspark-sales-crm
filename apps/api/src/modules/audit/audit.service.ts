import type { ListAuditEventsQuery, AuditEventResponse } from '@growspark/shared';
import { prisma } from '../../db/prisma.js';
import { scoped } from '../../lib/scoped.js';
import { toSkipTake, buildPaginationMeta } from '../../lib/pagination.js';
import type { RequestContext } from '../../lib/context.js';
import type { AuditEvent, Prisma } from '../../generated/prisma/client.js';

function toAuditEventResponse(event: AuditEvent): AuditEventResponse {
  return {
    id: event.id,
    actorId: event.actorId,
    action: event.action,
    entityType: event.entityType,
    entityId: event.entityId,
    metadata: event.metadata,
    createdAt: event.createdAt.toISOString(),
  };
}

export interface ListAuditEventsResult {
  data: AuditEventResponse[];
  meta: { page: number; pageSize: number; total: number };
}

export async function listAuditEvents(
  ctx: RequestContext,
  query: ListAuditEventsQuery,
): Promise<ListAuditEventsResult> {
  const where: Prisma.AuditEventWhereInput = {
    ...scoped(ctx),
    ...(query.action ? { action: query.action } : {}),
    ...(query.entityType ? { entityType: query.entityType } : {}),
    ...(query.actorId ? { actorId: query.actorId } : {}),
    ...(query.from || query.to
      ? {
          createdAt: {
            ...(query.from ? { gte: query.from } : {}),
            ...(query.to ? { lte: query.to } : {}),
          },
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.auditEvent.findMany({ where, orderBy: { createdAt: 'desc' }, ...toSkipTake(query) }),
    prisma.auditEvent.count({ where }),
  ]);

  return { data: rows.map(toAuditEventResponse), meta: buildPaginationMeta(query, total) };
}
