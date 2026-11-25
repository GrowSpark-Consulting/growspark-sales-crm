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

/**
 * Ordered for a dropdown. Active sources only by default; `includeInactive`
 * adds retired ones (each carries isActive) so a screen can still name the
 * source a record already has. Management lives in Settings (D93).
 */
export async function listLeadSourcesForPicker(ctx: RequestContext, includeInactive: boolean): Promise<LeadSourceResponse[]> {
  const rows = await prisma.leadSource.findMany({
    where: { ...scoped(ctx), ...(includeInactive ? {} : { isActive: true }) },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
  return rows.map(toLeadSourceResponse);
}
