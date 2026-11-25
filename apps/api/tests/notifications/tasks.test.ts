import { afterEach, describe, expect, it, vi } from 'vitest';
import { ROLES } from '@growspark/shared';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';
import { createTestTenant, type TestTenant } from '../helpers/tenant.js';
import { signIn } from '../helpers/quotations.js';
import { generateTaskNotifications, TASK_NOTIFICATION_BATCH_LIMIT } from '../../src/modules/notifications/notifications.service.js';
import type { RequestContext } from '../../src/lib/context.js';
import type { ActivityStatus, ActivityType } from '../../src/generated/prisma/client.js';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function staffCtx(tenant: TestTenant): RequestContext {
  return { userId: tenant.staffUser.id, orgId: tenant.organization.id, role: ROLES.STAFF };
}

/** Every activity must link to a record (the activities_has_link CHECK) — one lead per tenant is enough. */
const leadByTenant = new Map<string, string>();
async function leadFor(tenant: TestTenant): Promise<string> {
  const existing = leadByTenant.get(tenant.organization.id);
  if (existing) return existing;
  const lead = await prisma.lead.create({
    data: { organizationId: tenant.organization.id, firstName: 'Linked', email: 'linked@example.test', emailNormalized: 'linked@example.test', sourceId: tenant.leadSource.id },
  });
  leadByTenant.set(tenant.organization.id, lead.id);
  return lead.id;
}

async function task(
  tenant: TestTenant,
  dueAt: Date | null,
  extra: { assigneeId?: string | null; type?: ActivityType; status?: ActivityStatus; subject?: string } = {},
) {
  return prisma.activity.create({
    data: {
      organizationId: tenant.organization.id,
      type: extra.type ?? 'TASK',
      status: extra.status ?? 'OPEN',
      subject: extra.subject ?? 'Follow up',
      createdById: tenant.adminUser.id,
      assigneeId: extra.assigneeId === undefined ? tenant.staffUser.id : extra.assigneeId,
      dueAt,
      completedAt: extra.status === 'DONE' ? new Date() : null,
      leadId: await leadFor(tenant),
    },
  });
}

async function rowsFor(userId: string) {
  const rows = await prisma.notification.findMany({ where: { userId }, orderBy: { dedupeKey: 'asc' } });
  return rows.map((row) => ({ type: row.type, entityId: row.entityId, dedupeKey: row.dedupeKey }));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Task due / overdue notifications (generated on load, no worker)', () => {
  // 2026-11-25T06:30Z is 12:00 in Asia/Kolkata (the test organisation's default zone).
  const now = new Date('2026-11-25T06:30:00.000Z');

  it('due today -> TASK_DUE_TODAY keyed by the org date; before today -> TASK_OVERDUE; later, done, unassigned, other people\'s and non-TASK -> nothing', async () => {
    const tenant = await createTestTenant();
    const dueToday = await task(tenant, new Date('2026-11-25T12:00:00.000Z')); // 17:30 IST today
    const overdue = await task(tenant, new Date('2026-11-20T06:30:00.000Z'));
    await task(tenant, new Date('2026-11-26T06:30:00.000Z')); // tomorrow
    await task(tenant, null); // no due date
    await task(tenant, overdue.dueAt, { status: 'DONE' });
    await task(tenant, overdue.dueAt, { assigneeId: null });
    await task(tenant, overdue.dueAt, { assigneeId: tenant.adminUser.id });
    await task(tenant, overdue.dueAt, { type: 'CALL' });

    await generateTaskNotifications(staffCtx(tenant), now);

    expect(await rowsFor(tenant.staffUser.id)).toEqual([
      { type: 'TASK_DUE_TODAY', entityId: dueToday.id, dedupeKey: `task-due:${dueToday.id}:2026-11-25` },
      { type: 'TASK_OVERDUE', entityId: overdue.id, dedupeKey: `task-overdue:${overdue.id}` },
    ]);
    // Generation is for the caller only — the admin's own overdue task waits for the admin's next load.
    expect(await rowsFor(tenant.adminUser.id)).toEqual([]);
  });

  it('uses the organisation\'s time zone, not UTC, for "today"', async () => {
    const tenant = await createTestTenant();
    // 2026-11-24T20:00Z is already 01:30 on 25 Nov in Kolkata: a task due at
    // 2026-11-24T19:00Z (00:30 IST on the 25th) is due TODAY there, while in
    // UTC terms it would look like "yesterday".
    const t = await task(tenant, new Date('2026-11-24T19:00:00.000Z'));
    await generateTaskNotifications(staffCtx(tenant), new Date('2026-11-24T20:00:00.000Z'));
    expect(await rowsFor(tenant.staffUser.id)).toEqual([{ type: 'TASK_DUE_TODAY', entityId: t.id, dedupeKey: `task-due:${t.id}:2026-11-25` }]);
  });

  it('is de-duplicated: repeated loads add nothing; a still-open task becomes overdue the next day (one more row), then never again', async () => {
    const tenant = await createTestTenant();
    const t = await task(tenant, new Date('2026-11-25T12:00:00.000Z'));
    const ctx = staffCtx(tenant);

    await generateTaskNotifications(ctx, now);
    await generateTaskNotifications(ctx, new Date(now.getTime() + HOUR));
    expect(await prisma.notification.count()).toBe(1);

    await generateTaskNotifications(ctx, new Date(now.getTime() + DAY));
    await generateTaskNotifications(ctx, new Date(now.getTime() + 2 * DAY));
    await generateTaskNotifications(ctx, new Date(now.getTime() + 3 * DAY));
    expect(await rowsFor(tenant.staffUser.id)).toEqual([
      { type: 'TASK_DUE_TODAY', entityId: t.id, dedupeKey: `task-due:${t.id}:2026-11-25` },
      { type: 'TASK_OVERDUE', entityId: t.id, dedupeKey: `task-overdue:${t.id}` },
    ]);
  });

  it('concurrent loads cannot create duplicates (the unique index + skipDuplicates)', async () => {
    const tenant = await createTestTenant();
    await task(tenant, new Date('2026-11-20T06:30:00.000Z'));
    await task(tenant, new Date('2026-11-25T12:00:00.000Z'));
    const ctx = staffCtx(tenant);
    await Promise.all(Array.from({ length: 5 }, () => generateTaskNotifications(ctx, now)));
    expect(await prisma.notification.count()).toBe(2);
  });

  it(`caps one load at ${TASK_NOTIFICATION_BATCH_LIMIT} tasks, latest due first`, async () => {
    const tenant = await createTestTenant();
    const leadId = await leadFor(tenant);
    const total = TASK_NOTIFICATION_BATCH_LIMIT + 5;
    const tasks = await prisma.activity.createManyAndReturn({
      data: Array.from({ length: total }, (_, index) => ({
        organizationId: tenant.organization.id,
        type: 'TASK' as const,
        subject: `Task ${index}`,
        createdById: tenant.adminUser.id,
        assigneeId: tenant.staffUser.id,
        dueAt: new Date(now.getTime() - (index + 2) * DAY), // index 0 is the most recent
        leadId,
      })),
    });
    await generateTaskNotifications(staffCtx(tenant), now);
    const notified = new Set((await prisma.notification.findMany()).map((row) => row.entityId));
    expect(notified.size).toBe(TASK_NOTIFICATION_BATCH_LIMIT);
    expect(notified.has(tasks[0]!.id)).toBe(true);
    expect(notified.has(tasks[total - 1]!.id)).toBe(false);
  });

  it('runs on the list and unread-count requests, for the signed-in user', async () => {
    const tenant = await createTestTenant();
    await task(tenant, new Date(Date.now() - 3 * DAY), { subject: 'Send proposal' });
    const staff = await signIn(createApp(), tenant, 'staff');

    const count = await staff.get('/api/v1/notifications/unread-count');
    expect(count.body.data.unread).toBe(1);

    const list = await staff.get('/api/v1/notifications');
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0]).toMatchObject({ type: 'TASK_OVERDUE', title: 'Task overdue: Send proposal', href: `/leads/${await leadFor(tenant)}` });
  });

  it('a failure while generating never fails the read', async () => {
    const tenant = await createTestTenant();
    await task(tenant, new Date(Date.now() - 3 * DAY));
    vi.spyOn(prisma.activity, 'findMany').mockRejectedValue(new Error('simulated database failure'));
    const staff = await signIn(createApp(), tenant, 'staff');

    const count = await staff.get('/api/v1/notifications/unread-count');
    expect(count.status).toBe(200);
    expect(count.body.data.unread).toBe(0);
    const list = await staff.get('/api/v1/notifications');
    expect(list.status).toBe(200);
  });
});
