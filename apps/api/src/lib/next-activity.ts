import type { NextActivitySummary } from '@growspark/shared';
import { prisma } from '../db/prisma.js';
import { orgDayBounds } from './org-time.js';
import type { RequestContext } from './context.js';

type RecordLink = { leadId: string } | { dealId: string };

/** One organisation-scoped activity query for the detail record's next action. */
export async function findNextActivity(
  ctx: RequestContext,
  link: RecordLink,
  timeZone: string,
  now = new Date(),
): Promise<NextActivitySummary | null> {
  const activity = await prisma.activity.findFirst({
    where: {
      organizationId: ctx.orgId,
      ...link,
      status: 'OPEN',
      type: { in: ['TASK', 'CALL', 'MEETING'] },
    },
    orderBy: [{ dueAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }],
    select: { type: true, subject: true, dueAt: true },
  });
  if (!activity) return null;

  const dueAt = activity.dueAt?.toISOString() ?? null;
  return {
    type: activity.type as NextActivitySummary['type'],
    subject: activity.subject,
    dueAt,
    isOverdue: activity.dueAt !== null && activity.dueAt < orgDayBounds(now, timeZone).start,
  };
}
