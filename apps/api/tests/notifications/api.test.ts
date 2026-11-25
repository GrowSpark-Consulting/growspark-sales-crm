import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';
import { ALLOWED_ORIGIN } from '../helpers/http.js';
import { createTestTenant, createTwoTestTenants, type TestTenant } from '../helpers/tenant.js';
import { signIn } from '../helpers/quotations.js';
import type { NotificationType } from '../../src/generated/prisma/client.js';

async function seedNotification(tenant: TestTenant, userId: string, type: NotificationType, entityId: string, extra: { readAt?: Date; createdAt?: Date } = {}) {
  return prisma.notification.create({ data: { organizationId: tenant.organization.id, userId, type, entityId, ...extra } });
}

async function seedLead(tenant: TestTenant, firstName = 'Asha', lastName: string | null = 'Rao') {
  return prisma.lead.create({
    data: { organizationId: tenant.organization.id, firstName, lastName, email: `${firstName}@example.test`, emailNormalized: `${firstName}@example.test`, sourceId: tenant.leadSource.id },
  });
}

describe('Notifications API: list and unread count', () => {
  it('lists the caller\'s notifications newest first, with title and link built from the live record, and meta.unread', async () => {
    const tenant = await createTestTenant();
    const lead = await seedLead(tenant);
    const older = await seedNotification(tenant, tenant.staffUser.id, 'LEAD_ASSIGNED', lead.id, { createdAt: new Date(Date.now() - 60_000) });
    const newer = await seedNotification(tenant, tenant.staffUser.id, 'LEAD_ASSIGNED', lead.id, { readAt: new Date() });
    const staff = await signIn(createApp(), tenant, 'staff');

    const res = await staff.get('/api/v1/notifications');
    expect(res.status).toBe(200);
    expect(res.body.data.map((n: { id: string }) => n.id)).toEqual([newer.id, older.id]);
    expect(res.body.data[1]).toMatchObject({ type: 'LEAD_ASSIGNED', title: 'Lead assigned to you: Asha Rao', href: `/leads/${lead.id}`, readAt: null });
    expect(res.body.meta).toEqual({ page: 1, pageSize: 25, total: 2, unread: 1 });

    // Wording follows later edits: no copy of the name is stored.
    await prisma.lead.update({ where: { id: lead.id }, data: { firstName: 'Ashwini' } });
    const again = await staff.get('/api/v1/notifications');
    expect(again.body.data[0].title).toBe('Lead assigned to you: Ashwini Rao');
  });

  it('builds a title and link for every notification type', async () => {
    const tenant = await createTestTenant();
    const orgId = tenant.organization.id;
    const userId = tenant.adminUser.id;
    const lead = await seedLead(tenant);
    const company = await prisma.company.create({ data: { organizationId: orgId, name: 'Example Foods', nameNormalized: 'example foods' } });
    const contact = await prisma.contact.create({ data: { organizationId: orgId, companyId: company.id, firstName: 'C' , email: 'c@example.test', emailNormalized: 'c@example.test' } });
    const deal = await prisma.deal.create({
      data: { organizationId: orgId, name: 'Big deal', companyId: company.id, pipelineId: tenant.pipeline.id, stageId: tenant.stages[0]!.id, probability: 10 },
    });
    const linkedTask = await prisma.activity.create({ data: { organizationId: orgId, type: 'TASK', subject: 'Call back', createdById: userId, dealId: deal.id } });
    const contactTask = await prisma.activity.create({ data: { organizationId: orgId, type: 'TASK', subject: 'Tidy up', createdById: userId, contactId: contact.id } });
    const submission = await prisma.websiteSubmission.create({
      data: { organizationId: orgId, externalId: 'e1', formType: 'contact', payload: {}, status: 'LEAD_CREATED', leadId: lead.id },
    });
    const quotation = await prisma.quotation.create({
      data: { organizationId: orgId, number: 'Q-2026-0007', companyId: company.id, contactId: contact.id, issueDate: new Date('2026-11-01'), validUntil: new Date('2026-12-01'),
        discountPercent: 0, taxPercent: 18, subtotal: 0, discountAmount: 0, taxAmount: 0, total: 0 },
    });
    const rows: [NotificationType, string][] = [
      ['DEAL_ASSIGNED', deal.id],
      ['TASK_DUE_TODAY', linkedTask.id],
      ['TASK_OVERDUE', contactTask.id],
      ['NEW_ENQUIRY', submission.id],
      ['QUOTATION_ACCEPTED', quotation.id],
      ['QUOTATION_REJECTED', quotation.id],
    ];
    for (const [index, [type, entityId]] of rows.entries()) {
      await seedNotification(tenant, userId, type, entityId, { createdAt: new Date(Date.now() - (rows.length - index) * 1000) });
    }
    const admin = await signIn(createApp(), tenant);
    const res = await admin.get('/api/v1/notifications');
    expect(res.status).toBe(200);
    const byType = Object.fromEntries(res.body.data.map((n: { type: string; title: string; href: string }) => [n.type, { title: n.title, href: n.href }]));
    expect(byType).toEqual({
      DEAL_ASSIGNED: { title: 'Deal assigned to you: Big deal', href: `/deals/${deal.id}` },
      TASK_DUE_TODAY: { title: 'Task due today: Call back', href: `/deals/${deal.id}` },
      TASK_OVERDUE: { title: 'Task overdue: Tidy up', href: `/contacts/${contact.id}` },
      NEW_ENQUIRY: { title: 'New website enquiry from Asha Rao', href: `/enquiries/${submission.id}` },
      QUOTATION_ACCEPTED: { title: 'Quotation Q-2026-0007 accepted (Example Foods)', href: `/quotations/${quotation.id}` },
      QUOTATION_REJECTED: { title: 'Quotation Q-2026-0007 rejected (Example Foods)', href: `/quotations/${quotation.id}` },
    });
  });

  it('a notification whose record cannot be found still lists, with a generic title (never another organisation\'s data)', async () => {
    const [orgA, orgB] = await createTwoTestTenants();
    const leadInB = await seedLead(orgB, 'Secret', 'Person');
    // A row in A pointing at B's lead id must never reveal B's lead name.
    await seedNotification(orgA, orgA.adminUser.id, 'LEAD_ASSIGNED', leadInB.id);
    const admin = await signIn(createApp(), orgA);
    const res = await admin.get('/api/v1/notifications');
    expect(res.body.data[0]).toMatchObject({ title: 'A lead was assigned to you', href: `/leads/${leadInB.id}` });
    expect(JSON.stringify(res.body)).not.toContain('Secret');
  });

  it('unreadOnly=true filters to unread; pagination works; unread-count agrees', async () => {
    const tenant = await createTestTenant();
    const lead = await seedLead(tenant);
    for (let index = 0; index < 3; index += 1) await seedNotification(tenant, tenant.adminUser.id, 'LEAD_ASSIGNED', lead.id);
    await seedNotification(tenant, tenant.adminUser.id, 'LEAD_ASSIGNED', lead.id, { readAt: new Date() });
    const admin = await signIn(createApp(), tenant);

    const unreadOnly = await admin.get('/api/v1/notifications?unreadOnly=true');
    expect(unreadOnly.body.data).toHaveLength(3);
    expect(unreadOnly.body.meta).toMatchObject({ total: 3, unread: 3 });

    const page2 = await admin.get('/api/v1/notifications?page=2&pageSize=3');
    expect(page2.body.data).toHaveLength(1);
    expect(page2.body.meta).toMatchObject({ page: 2, pageSize: 3, total: 4, unread: 3 });

    const count = await admin.get('/api/v1/notifications/unread-count');
    expect(count.status).toBe(200);
    expect(count.body).toEqual({ data: { unread: 3 } });
  });

  it('every endpoint refuses an unauthenticated request with 401', async () => {
    const app = createApp();
    const id = '00000000-0000-7000-8000-000000000000';
    expect((await request(app).get('/api/v1/notifications')).status).toBe(401);
    expect((await request(app).get('/api/v1/notifications/unread-count')).status).toBe(401);
    expect((await request(app).post(`/api/v1/notifications/${id}/read`).set('Origin', ALLOWED_ORIGIN).send({})).status).toBe(401);
    expect((await request(app).post('/api/v1/notifications/read-all').set('Origin', ALLOWED_ORIGIN).send({})).status).toBe(401);
  });
});

describe('Notifications API: isolation', () => {
  it('a user never sees, counts, reads or bulk-reads another user\'s notifications in the same organisation (404 on direct read)', async () => {
    const tenant = await createTestTenant();
    const lead = await seedLead(tenant);
    const staffRow = await seedNotification(tenant, tenant.staffUser.id, 'LEAD_ASSIGNED', lead.id);
    const app = createApp();
    const admin = await signIn(app, tenant);

    const list = await admin.get('/api/v1/notifications');
    expect(list.body.data).toEqual([]);
    expect(list.body.meta).toMatchObject({ total: 0, unread: 0 });
    expect((await admin.get('/api/v1/notifications/unread-count')).body.data.unread).toBe(0);
    expect((await admin.post(`/api/v1/notifications/${staffRow.id}/read`)).status).toBe(404);
    expect((await admin.post('/api/v1/notifications/read-all')).body.data.updated).toBe(0);

    const after = await prisma.notification.findUniqueOrThrow({ where: { id: staffRow.id } });
    expect(after.readAt).toBeNull();
  });

  it('organisations are isolated the same way', async () => {
    const [orgA, orgB] = await createTwoTestTenants();
    const lead = await seedLead(orgB);
    const rowInB = await seedNotification(orgB, orgB.adminUser.id, 'LEAD_ASSIGNED', lead.id);
    const adminA = await signIn(createApp(), orgA);

    expect((await adminA.get('/api/v1/notifications')).body.data).toEqual([]);
    expect((await adminA.post(`/api/v1/notifications/${rowInB.id}/read`)).status).toBe(404);
    expect((await adminA.post('/api/v1/notifications/read-all')).body.data.updated).toBe(0);
    expect((await prisma.notification.findUniqueOrThrow({ where: { id: rowInB.id } })).readAt).toBeNull();
  });
});

describe('Notifications API: mark read', () => {
  it('marks one read, is idempotent (keeps the first read time), and leaves the others unread', async () => {
    const tenant = await createTestTenant();
    const lead = await seedLead(tenant);
    const first = await seedNotification(tenant, tenant.adminUser.id, 'LEAD_ASSIGNED', lead.id);
    await seedNotification(tenant, tenant.adminUser.id, 'LEAD_ASSIGNED', lead.id);
    const admin = await signIn(createApp(), tenant);

    const res = await admin.post(`/api/v1/notifications/${first.id}/read`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: first.id, title: 'Lead assigned to you: Asha Rao' });
    const readAt = res.body.data.readAt as string;
    expect(readAt).not.toBeNull();

    const again = await admin.post(`/api/v1/notifications/${first.id}/read`);
    expect(again.status).toBe(200);
    expect(again.body.data.readAt).toBe(readAt);

    expect((await admin.get('/api/v1/notifications/unread-count')).body.data.unread).toBe(1);
  });

  it('an invalid id is a 422; an unknown id is a 404', async () => {
    const tenant = await createTestTenant();
    const admin = await signIn(createApp(), tenant);
    expect((await admin.post('/api/v1/notifications/not-a-uuid/read')).status).toBe(422);
    expect((await admin.post('/api/v1/notifications/00000000-0000-7000-8000-000000000000/read')).status).toBe(404);
  });

  it('read-all marks every unread notification of the caller and reports how many', async () => {
    const tenant = await createTestTenant();
    const lead = await seedLead(tenant);
    await seedNotification(tenant, tenant.adminUser.id, 'LEAD_ASSIGNED', lead.id);
    await seedNotification(tenant, tenant.adminUser.id, 'LEAD_ASSIGNED', lead.id);
    await seedNotification(tenant, tenant.adminUser.id, 'LEAD_ASSIGNED', lead.id, { readAt: new Date() });
    await seedNotification(tenant, tenant.staffUser.id, 'LEAD_ASSIGNED', lead.id);
    const admin = await signIn(createApp(), tenant);

    const res = await admin.post('/api/v1/notifications/read-all');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { updated: 2 } });
    expect((await admin.get('/api/v1/notifications/unread-count')).body.data.unread).toBe(0);
    expect(await prisma.notification.count({ where: { userId: tenant.staffUser.id, readAt: null } })).toBe(1);
  });
});
