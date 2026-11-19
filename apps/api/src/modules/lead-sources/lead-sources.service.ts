import type { LeadSourceResponse } from '@growspark/shared';
import { prisma } from '../../db/prisma.js';
import { scoped } from '../../lib/scoped.js';
import type { RequestContext } from '../../lib/context.js';
import type { LeadSource } from '../../generated/prisma/client.js';

function toLeadSourceResponse(source: LeadSource): LeadSourceResponse {
  return {
    id: source.id,
    name: source.name,
    isActive: source.isActive,
    sortOrder: source.sortOrder,
  };
}

/** Active sources only, ordered for a dropdown — not a paginated admin list (lead source management is P1). */
export async function listActiveLeadSources(ctx: RequestContext): Promise<LeadSourceResponse[]> {
  const rows = await prisma.leadSource.findMany({
    where: { ...scoped(ctx), isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
  return rows.map(toLeadSourceResponse);
}
