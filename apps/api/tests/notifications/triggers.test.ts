import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';
import { createTestTenant, type TestTenant } from '../helpers/tenant.js';
import { createTestApiKey } from '../helpers/api-key.js';
import { ensureWebsiteLeadSource, intakeRequest } from '../helpers/intake.js';
import { createQuotationContext, quotationBody, signIn } from '../helpers/quotations.js';

/** What a user's notifications table holds, oldest first — type + entity only (no text is stored, D89). */
async function stored(tenant: TestTenant, userId: string) {
  const rows = await prisma.notification.findMany({
    where: { organizationId: tenant.organization.id, userId },
    orderBy: { createdAt: 'asc' },
  });
  return rows.map((row) => ({ type: row.type, entityId: row.entityId }));
}

function leadBody(tenant: TestTenant, extra: object = {}) {
  return { firstName: 'Asha', lastName: 'Rao', email: 'asha@example.test', sourceId: tenant.leadSource.id, ...extra };
}

function dealBody(companyId: string, extra: object = {}) {
  return { name: 'Plant automation', companyId, value: 100000, ...extra };
}

async function createCompany(tenant: TestTenant) {
  return prisma.company.create({ data: { organizationId: tenant.organization.id, name: 'Example Foods', nameNormalized: 'example foods' } });
}

describe('Notifications: lead assignment', () => {
  it('creating a lead owned by someone else notifies that owner, and the stored row holds no text', async () => {
    const tenant = await createTestTenant();
    const admin = await signIn(createApp(), tenant);
    const res = await admin.post('/api/v1/leads', leadBody(tenant, { ownerId: tenant.staffUser.id }));
    expect(res.status).toBe(201);

    expect(await stored(tenant, tenant.staffUser.id)).toEqual([{ type: 'LEAD_ASSIGNED', entityId: res.body.data.id }]);
    expect(await stored(tenant, tenant.adminUser.id)).toEqual([]);
    const row = await prisma.notification.findFirstOrThrow({ where: { userId: tenant.staffUser.id } });
    expect(Object.keys(row).sort()).toEqual(['createdAt', 'dedupeKey', 'entityId', 'id', 'organizationId', 'readAt', 'type', 'userId']);
    expect(row.dedupeKey).toBeNull();
  });

  it('assigning a lead to yourself, or leaving it unassigned, notifies nobody', async () => {
    const tenant = await createTestTenant();
    const admin = await signIn(createApp(), tenant);
    expect((await admin.post('/api/v1/leads', leadBody(tenant, { ownerId: tenant.adminUser.id }))).status).toBe(201);
    expect((await admin.post('/api/v1/leads', leadBody(tenant, { email: 'other@example.test' }))).status).toBe(201);
    expect(await prisma.notification.count()).toBe(0);
  });

  it('changing the owner on update notifies the new owner; re-saving the same owner or editing other fields does not', async () => {
    const tenant = await createTestTenant();
    const admin = await signIn(createApp(), tenant);
    const created = await admin.post('/api/v1/leads', leadBody(tenant));
    const leadId = created.body.data.id as string;

    expect((await admin.patch(`/api/v1/leads/${leadId}`, { ownerId: tenant.staffUser.id })).status).toBe(200);
    expect((await admin.patch(`/api/v1/leads/${leadId}`, { ownerId: tenant.staffUser.id })).status).toBe(200);
    expect((await admin.patch(`/api/v1/leads/${leadId}`, { jobTitle: 'Plant Manager' })).status).toBe(200);

    expect(await stored(tenant, tenant.staffUser.id)).toEqual([{ type: 'LEAD_ASSIGNED', entityId: leadId }]);
  });
});

describe('Notifications: deal assignment', () => {
  it('creating a deal owned by someone else notifies them; a deal you own yourself (the default) does not', async () => {
    const tenant = await createTestTenant();
    const admin = await signIn(createApp(), tenant);
    const company = await createCompany(tenant);

    const mine = await admin.post('/api/v1/deals', dealBody(company.id));
    expect(mine.status).toBe(201);
    const theirs = await admin.post('/api/v1/deals', dealBody(company.id, { ownerId: tenant.staffUser.id }));
    expect(theirs.status).toBe(201);

    expect(await stored(tenant, tenant.staffUser.id)).toEqual([{ type: 'DEAL_ASSIGNED', entityId: theirs.body.data.id }]);
    expect(await stored(tenant, tenant.adminUser.id)).toEqual([]);
  });

  it('reassigning a deal on update notifies the new owner only when the owner actually changes', async () => {
    const tenant = await createTestTenant();
    const admin = await signIn(createApp(), tenant);
    const company = await createCompany(tenant);
    const deal = await admin.post('/api/v1/deals', dealBody(company.id));
    const dealId = deal.body.data.id as string;

    expect((await admin.patch(`/api/v1/deals/${dealId}`, { name: 'Renamed' })).status).toBe(200);
    expect((await admin.patch(`/api/v1/deals/${dealId}`, { ownerId: tenant.staffUser.id })).status).toBe(200);
    expect((await admin.patch(`/api/v1/deals/${dealId}`, { ownerId: tenant.staffUser.id })).status).toBe(200);

    expect(await stored(tenant, tenant.staffUser.id)).toEqual([{ type: 'DEAL_ASSIGNED', entityId: dealId }]);
  });

  it('a deal created by lead conversion notifies its owner (here: the lead owner) when that is not the converter', async () => {
    const tenant = await createTestTenant();
    const admin = await signIn(createApp(), tenant);
    const lead = await admin.post('/api/v1/leads', leadBody(tenant, { companyName: 'Example Foods', ownerId: tenant.staffUser.id }));
    const leadId = lead.body.data.id as string;
    expect((await admin.post(`/api/v1/leads/${leadId}/status`, { status: 'QUALIFIED' })).status).toBe(200);

    const converted = await admin.post(`/api/v1/leads/${leadId}/convert`, { createDeal: true, deal: { value: 1000 } });
    expect(converted.status).toBe(200);

    expect(await stored(tenant, tenant.staffUser.id)).toEqual([
      { type: 'LEAD_ASSIGNED', entityId: leadId },
      { type: 'DEAL_ASSIGNED', entityId: converted.body.data.dealId },
    ]);
  });

  it('a conversion without a deal, or whose deal the converter owns, adds no deal notification', async () => {
    const tenant = await createTestTenant();
    const admin = await signIn(createApp(), tenant);
    for (const [index, body] of [{}, { createDeal: true, deal: { ownerId: tenant.adminUser.id } }].entries()) {
      const lead = await admin.post('/api/v1/leads', leadBody(tenant, { email: `l${index}@example.test`, companyName: `Co ${index}` }));
      const leadId = lead.body.data.id as string;
      await admin.post(`/api/v1/leads/${leadId}/status`, { status: 'QUALIFIED' });
      expect((await admin.post(`/api/v1/leads/${leadId}/convert`, body)).status).toBe(200);
    }
    expect(await prisma.notification.count()).toBe(0);
  });
});

describe('Notifications: new website enquiry', () => {
  it('a successful intake notifies every ACTIVE user in the organisation, and nobody in another organisation', async () => {
    const tenant = await createTestTenant();
    const other = await createTestTenant();
    await ensureWebsiteLeadSource(tenant);
    const inactive = await prisma.user.create({
      data: { organizationId: tenant.organization.id, email: 'gone@example.test', name: 'Gone', passwordHash: 'x', role: 'STAFF', isActive: false },
    });
    const { key } = await createTestApiKey(tenant);

    const res = await intakeRequest(createApp(), key, 'ext-n1', { formType: 'contact', fields: { name: 'Ravi Kumar', email: 'ravi@example.test' } });
    expect(res.status).toBe(201);
    const submissionId = res.body.data.submissionId as string;

    expect(await stored(tenant, tenant.adminUser.id)).toEqual([{ type: 'NEW_ENQUIRY', entityId: submissionId }]);
    expect(await stored(tenant, tenant.staffUser.id)).toEqual([{ type: 'NEW_ENQUIRY', entityId: submissionId }]);
    expect(await stored(tenant, inactive.id)).toEqual([]);
    expect(await prisma.notification.count({ where: { organizationId: other.organization.id } })).toBe(0);
  });

  it('a replayed Idempotency-Key, a honeypot hit and a rejected submission notify nobody', async () => {
    const tenant = await createTestTenant();
    await ensureWebsiteLeadSource(tenant);
    const { key } = await createTestApiKey(tenant);
    const app = createApp();
    const body = { formType: 'contact', fields: { name: 'Ravi Kumar', email: 'ravi@example.test' } };

    expect((await intakeRequest(app, key, 'ext-r', body)).status).toBe(201);
    expect((await intakeRequest(app, key, 'ext-r', body)).status).toBe(200);
    expect((await intakeRequest(app, key, 'ext-spam', { ...body, hp: 'bot' })).status).toBe(201);
    expect((await intakeRequest(app, key, 'ext-bad', { formType: 'contact', fields: { name: 'No Contact' } })).status).toBe(422);

    // Only the first, real submission: one row per user (admin + staff).
    expect(await prisma.notification.count()).toBe(2);
  });
});

describe('Notifications: quotation accepted / rejected', () => {
  async function sentQuotationOwnedByStaff(tenant: TestTenant) {
    const app = createApp();
    const staff = await signIn(app, tenant, 'staff');
    const context = await createQuotationContext(tenant);
    const created = await staff.post('/api/v1/quotations', quotationBody(context));
    expect(created.status).toBe(201);
    const id = created.body.data.id as string;
    expect((await staff.post(`/api/v1/quotations/${id}/status`, { status: 'SENT' })).status).toBe(200);
    return { app, staff, id };
  }

  it('the owner hears when someone else accepts, and when someone else rejects', async () => {
    const tenant = await createTestTenant();
    const first = await sentQuotationOwnedByStaff(tenant);
    const admin = await signIn(first.app, tenant);
    expect((await admin.post(`/api/v1/quotations/${first.id}/status`, { status: 'ACCEPTED' })).status).toBe(200);

    const second = await sentQuotationOwnedByStaff(tenant);
    expect((await admin.post(`/api/v1/quotations/${second.id}/status`, { status: 'REJECTED' })).status).toBe(200);

    expect(await stored(tenant, tenant.staffUser.id)).toEqual([
      { type: 'QUOTATION_ACCEPTED', entityId: first.id },
      { type: 'QUOTATION_REJECTED', entityId: second.id },
    ]);
    expect(await stored(tenant, tenant.adminUser.id)).toEqual([]);
  });

  it('the owner accepting their own quotation, or marking it sent, notifies nobody', async () => {
    const tenant = await createTestTenant();
    const { staff, id } = await sentQuotationOwnedByStaff(tenant);
    expect((await staff.post(`/api/v1/quotations/${id}/status`, { status: 'ACCEPTED' })).status).toBe(200);
    expect(await prisma.notification.count()).toBe(0);
  });
});
