import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';
import { createTestTenant } from '../helpers/tenant.js';
import { createTestApiKey } from '../helpers/api-key.js';
import { ensureWebsiteLeadSource, intakeRequest } from '../helpers/intake.js';
import { createQuotationContext, quotationBody, signIn } from '../helpers/quotations.js';

/**
 * PRD §11: "A failed notification must not roll back a valid lead creation."
 * Each test forces every notification write to fail and proves the main
 * action still committed, still answered with its normal success, and still
 * wrote its audit row.
 */
function breakNotificationWrites() {
  return vi.spyOn(prisma.notification, 'createMany').mockRejectedValue(new Error('simulated notification failure'));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('A failed notification never rolls back or fails the main action', () => {
  it('lead create (assigned to someone else): 201, the lead and its audit row exist, no notification', async () => {
    const tenant = await createTestTenant();
    const admin = await signIn(createApp(), tenant);
    const spy = breakNotificationWrites();

    const res = await admin.post('/api/v1/leads', { companyName: 'Fixture Co', firstName: 'Asha', email: 'asha@example.test', sourceId: tenant.leadSource.id, ownerId: tenant.staffUser.id });
    expect(res.status).toBe(201);
    expect(spy).toHaveBeenCalledTimes(1);
    const leadId = res.body.data.id as string;
    expect(await prisma.lead.findUnique({ where: { id: leadId } })).not.toBeNull();
    expect(await prisma.auditEvent.count({ where: { action: 'lead.created', entityId: leadId } })).toBe(1);
    expect(await prisma.notification.count()).toBe(0);
  });

  it('website intake: 201 with the lead, the submission is LEAD_CREATED, a replay still returns the same lead', async () => {
    const tenant = await createTestTenant();
    await ensureWebsiteLeadSource(tenant);
    const { key } = await createTestApiKey(tenant);
    const app = createApp();
    const spy = breakNotificationWrites();
    const body = { formType: 'contact', fields: { name: 'Ravi Kumar', email: 'ravi@example.test' } };

    const res = await intakeRequest(app, key, 'ext-fail', body);
    expect(res.status).toBe(201);
    expect(spy).toHaveBeenCalledTimes(1);
    const leadId = res.body.data.leadId as string;
    expect(leadId).not.toBeNull();
    const submission = await prisma.websiteSubmission.findUniqueOrThrow({ where: { id: res.body.data.submissionId as string } });
    expect(submission).toMatchObject({ status: 'LEAD_CREATED', leadId });
    expect(await prisma.notification.count()).toBe(0);

    const replay = await intakeRequest(app, key, 'ext-fail', body);
    expect(replay.status).toBe(200);
    expect(replay.body.data.leadId).toBe(leadId);
  });

  it('deal create and quotation accept still succeed', async () => {
    const tenant = await createTestTenant();
    const app = createApp();
    const admin = await signIn(app, tenant);
    const staff = await signIn(app, tenant, 'staff');
    const context = await createQuotationContext(tenant);
    const quotation = await staff.post('/api/v1/quotations', quotationBody(context));
    const quotationId = quotation.body.data.id as string;
    expect((await staff.post(`/api/v1/quotations/${quotationId}/status`, { status: 'SENT' })).status).toBe(200);
    const spy = breakNotificationWrites();

    const deal = await admin.post('/api/v1/deals', { name: 'D', companyId: context.company.id, ownerId: tenant.staffUser.id });
    expect(deal.status).toBe(201);
    const accepted = await admin.post(`/api/v1/quotations/${quotationId}/status`, { status: 'ACCEPTED' });
    expect(accepted.status).toBe(200);
    expect(accepted.body.data.status).toBe('ACCEPTED');
    expect(spy).toHaveBeenCalledTimes(2);
    expect((await prisma.quotation.findUniqueOrThrow({ where: { id: quotationId } })).status).toBe('ACCEPTED');
    expect(await prisma.notification.count()).toBe(0);
  });

  it('PROOF the spy is what blocks the write: without it, the same lead create does notify', async () => {
    const tenant = await createTestTenant();
    const admin = await signIn(createApp(), tenant);
    const res = await admin.post('/api/v1/leads', { companyName: 'Fixture Co', firstName: 'Asha', email: 'asha@example.test', sourceId: tenant.leadSource.id, ownerId: tenant.staffUser.id });
    expect(res.status).toBe(201);
    expect(await prisma.notification.count()).toBe(1);
  });
});
