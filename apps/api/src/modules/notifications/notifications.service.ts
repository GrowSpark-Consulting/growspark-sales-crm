import type { ListNotificationsQuery, NotificationResponse, NotificationType } from '@growspark/shared';
import { prisma } from '../../db/prisma.js';
import { ApiError } from '../../middleware/error-handler.js';
import { scoped } from '../../lib/scoped.js';
import { toSkipTake, buildPaginationMeta } from '../../lib/pagination.js';
import { orgDayBounds, orgDateKey } from '../../lib/org-time.js';
import { logger } from '../../logger.js';
import type { RequestContext } from '../../lib/context.js';
import type { Notification, Prisma } from '../../generated/prisma/client.js';

/**
 * In-app notifications (Day 5c, D89/D90). A row holds only who it is for, its
 * type and the id of the record it is about — never text or personal data.
 * Titles and links are built when the list is read, from the live record.
 *
 * Every write here is best-effort and runs AFTER the main transaction has
 * committed (PRD §11: a failed notification must not roll back a valid lead):
 * errors are logged and swallowed, never thrown back to the caller.
 */

interface NewNotification {
  userId: string;
  type: NotificationType;
  entityId: string;
  dedupeKey?: string;
}

/** The most task reminders generated for one user on one load (D90). */
export const TASK_NOTIFICATION_BATCH_LIMIT = 50;

async function insertNotifications(orgId: string, rows: readonly NewNotification[], context: string): Promise<void> {
  if (rows.length === 0) return;
  try {
    await prisma.notification.createMany({
      data: rows.map((row) => ({
        organizationId: orgId,
        userId: row.userId,
        type: row.type,
        entityId: row.entityId,
        dedupeKey: row.dedupeKey ?? null,
      })),
      skipDuplicates: true,
    });
  } catch (err) {
    logger.warn({ err, orgId, context }, 'notification write failed; the main action already succeeded');
  }
}

/**
 * A lead or deal was given an owner. Nobody is notified about an assignment
 * they made to themselves, and an unassigned record notifies nobody.
 */
export async function notifyAssignment(
  ctx: RequestContext,
  type: 'LEAD_ASSIGNED' | 'DEAL_ASSIGNED',
  entityId: string,
  ownerId: string | null | undefined,
): Promise<void> {
  if (!ownerId || ownerId === ctx.userId) return;
  await insertNotifications(ctx.orgId, [{ userId: ownerId, type, entityId }], type);
}

/** A website enquiry created a lead: every active user in the organisation hears about it. */
export async function notifyNewEnquiry(orgId: string, submissionId: string): Promise<void> {
  try {
    const users = await prisma.user.findMany({ where: { organizationId: orgId, isActive: true }, select: { id: true } });
    await insertNotifications(orgId, users.map((user) => ({ userId: user.id, type: 'NEW_ENQUIRY', entityId: submissionId })), 'NEW_ENQUIRY');
  } catch (err) {
    logger.warn({ err, orgId, context: 'NEW_ENQUIRY' }, 'notification write failed; the main action already succeeded');
  }
}

/** A quotation was accepted or rejected: its owner hears, unless the owner made the change. */
export async function notifyQuotationDecision(
  ctx: RequestContext,
  quotationId: string,
  ownerId: string | null,
  status: 'ACCEPTED' | 'REJECTED',
): Promise<void> {
  if (!ownerId || ownerId === ctx.userId) return;
  const type = status === 'ACCEPTED' ? 'QUOTATION_ACCEPTED' : 'QUOTATION_REJECTED';
  await insertNotifications(ctx.orgId, [{ userId: ownerId, type, entityId: quotationId }], type);
}

/**
 * Task due today / overdue, without a background worker: run for the signed-in
 * user only, when they load the app (list and unread-count requests). Covers
 * OPEN activities of type TASK assigned to them, using the organisation's time
 * zone. De-duplicated by the (organisation, user, dedupe_key) unique index:
 * `task-due:<id>:<org date>` (at most one per task per day) and
 * `task-overdue:<id>` (at most one per task, ever). Capped at
 * TASK_NOTIFICATION_BATCH_LIMIT tasks per load, latest due date first, so a
 * long backlog of very old overdue tasks cannot make every request slow.
 * Best-effort: never fails the read.
 */
export async function generateTaskNotifications(ctx: RequestContext, now = new Date()): Promise<void> {
  try {
    const organization = await prisma.organization.findUnique({ where: { id: ctx.orgId }, select: { timezone: true } });
    if (!organization) return;
    const today = orgDayBounds(now, organization.timezone);
    const todayKey = orgDateKey(now, organization.timezone);
    const tasks = await prisma.activity.findMany({
      where: { ...scoped(ctx), assigneeId: ctx.userId, type: 'TASK', status: 'OPEN', dueAt: { lt: today.end } },
      select: { id: true, dueAt: true },
      orderBy: { dueAt: 'desc' },
      take: TASK_NOTIFICATION_BATCH_LIMIT,
    });
    const rows: NewNotification[] = tasks.map((task) =>
      task.dueAt! >= today.start
        ? { userId: ctx.userId, type: 'TASK_DUE_TODAY', entityId: task.id, dedupeKey: `task-due:${task.id}:${todayKey}` }
        : { userId: ctx.userId, type: 'TASK_OVERDUE', entityId: task.id, dedupeKey: `task-overdue:${task.id}` },
    );
    await insertNotifications(ctx.orgId, rows, 'task-reminders');
  } catch (err) {
    logger.warn({ err, orgId: ctx.orgId, context: 'task-reminders' }, 'task notification generation failed; the read continues');
  }
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

function personName(firstName: string, lastName: string | null): string {
  return [firstName, lastName].filter(Boolean).join(' ');
}

function activityHref(activity: { leadId: string | null; contactId: string | null; companyId: string | null; dealId: string | null }): string {
  if (activity.leadId) return `/leads/${activity.leadId}`;
  if (activity.contactId) return `/contacts/${activity.contactId}`;
  if (activity.companyId) return `/companies/${activity.companyId}`;
  if (activity.dealId) return `/deals/${activity.dealId}`;
  return '/tasks';
}

type Presented = { title: string; href: string };

/**
 * Builds title and href for a page of notifications with one query per record
 * kind (never one per row). Every lookup is organisation-scoped. Business
 * records are archived rather than deleted, so a missing record is not
 * expected; it still gets a safe generic title rather than an error.
 */
async function presentNotifications(orgId: string, rows: readonly Notification[]): Promise<Map<string, Presented>> {
  const idsOf = (...types: NotificationType[]) => [...new Set(rows.filter((row) => types.includes(row.type)).map((row) => row.entityId))];
  const leadIds = idsOf('LEAD_ASSIGNED');
  const dealIds = idsOf('DEAL_ASSIGNED');
  const taskIds = idsOf('TASK_DUE_TODAY', 'TASK_OVERDUE');
  const submissionIds = idsOf('NEW_ENQUIRY');
  const quotationIds = idsOf('QUOTATION_ACCEPTED', 'QUOTATION_REJECTED');
  const org = { organizationId: orgId };

  const [leads, deals, tasks, submissions, quotations] = await Promise.all([
    leadIds.length ? prisma.lead.findMany({ where: { ...org, id: { in: leadIds } }, select: { id: true, firstName: true, lastName: true } }) : [],
    dealIds.length ? prisma.deal.findMany({ where: { ...org, id: { in: dealIds } }, select: { id: true, name: true } }) : [],
    taskIds.length
      ? prisma.activity.findMany({
          where: { ...org, id: { in: taskIds } },
          select: { id: true, subject: true, leadId: true, contactId: true, companyId: true, dealId: true },
        })
      : [],
    submissionIds.length
      ? prisma.websiteSubmission.findMany({
          where: { ...org, id: { in: submissionIds } },
          select: { id: true, lead: { select: { firstName: true, lastName: true } } },
        })
      : [],
    quotationIds.length
      ? prisma.quotation.findMany({ where: { ...org, id: { in: quotationIds } }, select: { id: true, number: true, company: { select: { name: true } } } })
      : [],
  ]);

  const leadById = new Map(leads.map((lead) => [lead.id, lead]));
  const dealById = new Map(deals.map((deal) => [deal.id, deal]));
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const submissionById = new Map(submissions.map((submission) => [submission.id, submission]));
  const quotationById = new Map(quotations.map((quotation) => [quotation.id, quotation]));

  const presented = new Map<string, Presented>();
  for (const row of rows) {
    presented.set(row.id, present(row));
  }
  return presented;

  function present(row: Notification): Presented {
    switch (row.type) {
      case 'LEAD_ASSIGNED': {
        const lead = leadById.get(row.entityId);
        return { title: lead ? `Lead assigned to you: ${personName(lead.firstName, lead.lastName)}` : 'A lead was assigned to you', href: `/leads/${row.entityId}` };
      }
      case 'DEAL_ASSIGNED': {
        const deal = dealById.get(row.entityId);
        return { title: deal ? `Deal assigned to you: ${deal.name}` : 'A deal was assigned to you', href: `/deals/${row.entityId}` };
      }
      case 'TASK_DUE_TODAY':
      case 'TASK_OVERDUE': {
        const task = taskById.get(row.entityId);
        const prefix = row.type === 'TASK_DUE_TODAY' ? 'Task due today' : 'Task overdue';
        return { title: task ? `${prefix}: ${task.subject}` : prefix, href: task ? activityHref(task) : '/tasks' };
      }
      case 'NEW_ENQUIRY': {
        const lead = submissionById.get(row.entityId)?.lead;
        return { title: lead ? `New form submission from ${personName(lead.firstName, lead.lastName)}` : 'New form submission', href: `/form-submissions/${row.entityId}` };
      }
      case 'QUOTATION_ACCEPTED':
      case 'QUOTATION_REJECTED': {
        const quotation = quotationById.get(row.entityId);
        const outcome = row.type === 'QUOTATION_ACCEPTED' ? 'accepted' : 'rejected';
        return {
          title: quotation ? `Quotation ${quotation.number} ${outcome} (${quotation.company.name})` : `A quotation was ${outcome}`,
          href: `/quotations/${row.entityId}`,
        };
      }
    }
  }
}

function toNotificationResponse(row: Notification, presented: Presented): NotificationResponse {
  return {
    id: row.id,
    type: row.type,
    title: presented.title,
    href: presented.href,
    readAt: row.readAt ? row.readAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Every notification query is scoped by organisation AND recipient — another user's row is invisible (404). */
function mine(ctx: RequestContext): { organizationId: string; userId: string } {
  return { ...scoped(ctx), userId: ctx.userId };
}

function countUnread(ctx: RequestContext): Promise<number> {
  return prisma.notification.count({ where: { ...mine(ctx), readAt: null } });
}

export interface ListNotificationsResult {
  data: NotificationResponse[];
  meta: { page: number; pageSize: number; total: number; unread: number };
}

export async function listNotifications(ctx: RequestContext, query: ListNotificationsQuery, now = new Date()): Promise<ListNotificationsResult> {
  await generateTaskNotifications(ctx, now);
  const where: Prisma.NotificationWhereInput = { ...mine(ctx), ...(query.unreadOnly ? { readAt: null } : {}) };
  const [rows, total, unread] = await Promise.all([
    prisma.notification.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], ...toSkipTake(query) }),
    prisma.notification.count({ where }),
    countUnread(ctx),
  ]);
  const presented = await presentNotifications(ctx.orgId, rows);
  return {
    data: rows.map((row) => toNotificationResponse(row, presented.get(row.id)!)),
    meta: { ...buildPaginationMeta(query, total), unread },
  };
}

export async function getUnreadCount(ctx: RequestContext, now = new Date()): Promise<number> {
  await generateTaskNotifications(ctx, now);
  return countUnread(ctx);
}

/** Idempotent: marking an already-read notification read again keeps its first read time. */
export async function markNotificationRead(ctx: RequestContext, id: string, now = new Date()): Promise<NotificationResponse> {
  await prisma.notification.updateMany({ where: { id, ...mine(ctx), readAt: null }, data: { readAt: now } });
  const row = await prisma.notification.findFirst({ where: { id, ...mine(ctx) } });
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Notification not found');
  const presented = await presentNotifications(ctx.orgId, [row]);
  return toNotificationResponse(row, presented.get(row.id)!);
}

export async function markAllNotificationsRead(ctx: RequestContext, now = new Date()): Promise<number> {
  const { count } = await prisma.notification.updateMany({ where: { ...mine(ctx), readAt: null }, data: { readAt: now } });
  return count;
}
