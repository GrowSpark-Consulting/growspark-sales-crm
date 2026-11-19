import { Prisma } from '../generated/prisma/client.js';
import type { RequestContext } from './context.js';

export interface WriteAuditInput {
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Writes one audit row. Must be called with the same transaction client as
 * the change it records — never after a commit, never best-effort.
 */
export async function writeAudit(
  tx: Prisma.TransactionClient,
  ctx: RequestContext,
  input: WriteAuditInput,
): Promise<void> {
  await tx.auditEvent.create({
    data: {
      organizationId: ctx.orgId,
      actorId: ctx.userId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      metadata: input.metadata ? (input.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
    },
  });
}
