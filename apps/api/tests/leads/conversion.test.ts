import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { normalizeCompanyName, normalizeEmail, normalizePhone } from '@growspark/shared';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';
import { createTestTenant, createTwoTestTenants, type TestTenant } from '../helpers/tenant.js';
import { createSession } from '../../src/lib/session.js';
import { ALLOWED_ORIGIN, sessionCookieHeader } from '../helpers/http.js';

function authed(app: ReturnType<typeof createApp>, token: string) {
  const cookie = sessionCookieHeader(token);
  return {
    get: (path: string) => request(app).get(path).set('Cookie', cookie),
    post: (path: string, body?: object) =>
      request(app).post(path).set('Origin', ALLOWED_ORIGIN).set('Cookie', cookie).send(body ?? {}),
  };
}

async function createQualifiedLead(
  api: ReturnType<typeof authed>,
  tenant: TestTenant,
  overrides: Record<string, unknown> = {},
) {
  const createRes = await api.post('/api/v1/leads', {
    firstName: 'Asha',
    lastName: 'Rao',
    email: 'asha.rao@example.com',
    phone: '+919876543210',
    companyName: 'Example Foods',
    jobTitle: 'Plant Manager',
    sourceId: tenant.leadSource.id,
    ...overrides,
  });
  expect(createRes.status).toBe(201);
  const leadId = createRes.body.data.id as string;
  const statusRes = await api.post(`/api/v1/leads/${leadId}/status`, { status: 'QUALIFIED' });
  expect(statusRes.status).toBe(200);
  return leadId;
}

describe('Lead conversion (Day 3, the conversion transaction)', () => {
  it('new company + new contact + a deal: everything is created correctly', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();
    const api = authed(app, token);
    const leadId = await createQualifiedLead(api, tenant);

    const res = await api.post(`/api/v1/leads/${leadId}/convert`, {
      createDeal: true,
      deal: { value: 500000, dealType: 'New business' },
    });
    expect(res.status).toBe(200);
    expect(res.body.data.createdCompany).toBe(true);
    expect(res.body.data.createdContact).toBe(true);
    expect(res.body.data.dealId).not.toBeNull();

    const { companyId, contactId, dealId } = res.body.data;

    const company = await prisma.company.findUniqueOrThrow({ where: { id: companyId } });
    expect(company.name).toBe('Example Foods');
    expect(company.nameNormalized).toBe(normalizeCompanyName('Example Foods'));

    const contact = await prisma.contact.findUniqueOrThrow({ where: { id: contactId } });
    expect(contact.firstName).toBe('Asha');
    expect(contact.lastName).toBe('Rao');
    expect(contact.email).toBe('asha.rao@example.com');
    expect(contact.phone).toBe('+919876543210');
    expect(contact.jobTitle).toBe('Plant Manager');
    expect(contact.companyId).toBe(companyId);

    const deal = await prisma.deal.findUniqueOrThrow({ where: { id: dealId! } });
    expect(deal.companyId).toBe(companyId);
    expect(deal.name).toBe('Example Foods - Asha Rao');
    expect(deal.value.toString()).toBe('500000');
    expect(deal.dealType).toBe('New business');
    expect(deal.probability).toBe(10); // first OPEN stage, "Qualification"
    expect(deal.stageId).toBe(tenant.stages[0]!.id);

    const dealContact = await prisma.dealContact.findUniqueOrThrow({
      where: { dealId_contactId: { dealId: dealId!, contactId } },
    });
    expect(dealContact.isPrimary).toBe(true);

    const stageHistory = await prisma.dealStageHistory.findMany({ where: { dealId: dealId! } });
    expect(stageHistory).toHaveLength(1);
    expect(stageHistory[0]!.fromStageId).toBeNull();
    expect(stageHistory[0]!.toStageId).toBe(tenant.stages[0]!.id);

    const conversion = await prisma.leadConversion.findUniqueOrThrow({ where: { leadId } });
    expect(conversion.companyId).toBe(companyId);
    expect(conversion.contactId).toBe(contactId);
    expect(conversion.dealId).toBe(dealId);
    expect(conversion.createdCompany).toBe(true);
    expect(conversion.createdContact).toBe(true);

    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
    expect(lead.status).toBe('CONVERTED');
    expect(lead.convertedAt).not.toBeNull();
    // Original lead fields are untouched by conversion.
    expect(lead.firstName).toBe('Asha');
    expect(lead.companyName).toBe('Example Foods');

    const history = await prisma.leadStatusHistory.findMany({ where: { leadId }, orderBy: { createdAt: 'asc' } });
    expect(history.map((h) => [h.fromStatus, h.toStatus])).toEqual([
      ['NEW', 'QUALIFIED'],
      ['QUALIFIED', 'CONVERTED'],
    ]);

    // Package 3.5: GET /leads/:id now carries what the conversion created
    // or linked, for the detail page's "Converted" panel.
    const getRes = await api.get(`/api/v1/leads/${leadId}`);
    expect(getRes.body.data.conversion).toEqual({ companyId, contactId, dealId });
  });

  it('GET /leads/:id returns conversion: null for a lead that has never been converted (package 3.5)', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();
    const api = authed(app, token);
    const leadId = await createQualifiedLead(api, tenant);

    const res = await api.get(`/api/v1/leads/${leadId}`);
    expect(res.body.data.conversion).toBeNull();
  });

  it('companyName in the request body overrides a lead with no company name, instead of a 422 (package 3.5)', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();
    const api = authed(app, token);
    // No companyName on the lead itself — would 422 without the override.
    // D98: a lead can no longer be *created* without one, but website
    // enquiries and leads from before D98 can lack it, so blank it directly.
    const leadId = await createQualifiedLead(api, tenant);
    await prisma.lead.update({ where: { id: leadId }, data: { companyName: null, companyNameNormalized: null } });

    const res = await api.post(`/api/v1/leads/${leadId}/convert`, { companyName: 'Typed In Dialog Co' });
    expect(res.status).toBe(200);
    expect(res.body.data.createdCompany).toBe(true);

    const company = await prisma.company.findUniqueOrThrow({ where: { id: res.body.data.companyId } });
    expect(company.name).toBe('Typed In Dialog Co');
  });

  it('still rejects with 422 when neither the lead nor the request body has a company name (package 3.5)', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();
    const api = authed(app, token);
    const leadId = await createQualifiedLead(api, tenant);
    await prisma.lead.update({ where: { id: leadId }, data: { companyName: null, companyNameNormalized: null } });

    const res = await api.post(`/api/v1/leads/${leadId}/convert`, {});
    expect(res.status).toBe(422);
  });

  it('existing company + new contact, no deal', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();
    const api = authed(app, token);

    const existingCompany = await prisma.company.create({
      data: { organizationId: tenant.organization.id, name: 'Existing Co', nameNormalized: 'existing co' },
    });
    const leadId = await createQualifiedLead(api, tenant, { companyName: 'Some Other Name' });

    const res = await api.post(`/api/v1/leads/${leadId}/convert`, { companyId: existingCompany.id });
    expect(res.status).toBe(200);
    expect(res.body.data.companyId).toBe(existingCompany.id);
    expect(res.body.data.createdCompany).toBe(false);
    expect(res.body.data.createdContact).toBe(true);
    expect(res.body.data.dealId).toBeNull();

    const companiesCount = await prisma.company.count({ where: { organizationId: tenant.organization.id } });
    expect(companiesCount).toBe(1); // no second company was created

    const contact = await prisma.contact.findUniqueOrThrow({ where: { id: res.body.data.contactId } });
    expect(contact.companyId).toBe(existingCompany.id);
  });

  it('both existing: fills only empty fields from the lead, and never overwrites the contact\'s company', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();
    const api = authed(app, token);

    const originalCompany = await prisma.company.create({
      data: { organizationId: tenant.organization.id, name: 'Original Co', nameNormalized: 'original co' },
    });
    const otherCompany = await prisma.company.create({
      data: { organizationId: tenant.organization.id, name: 'Other Co', nameNormalized: 'other co' },
    });
    const existingContact = await prisma.contact.create({
      data: {
        organizationId: tenant.organization.id,
        companyId: originalCompany.id,
        firstName: 'Deepak',
        email: 'deepak.existing@example.com',
        emailNormalized: normalizeEmail('deepak.existing@example.com'),
        // phone deliberately blank — the lead's phone should fill it.
      },
    });

    const leadId = await createQualifiedLead(api, tenant, {
      firstName: 'Deepak',
      email: 'deepak.lead@example.com', // different from the contact's existing email
      phone: '+919988776655',
    });

    const res = await api.post(`/api/v1/leads/${leadId}/convert`, {
      companyId: otherCompany.id, // a DIFFERENT company than the contact's own
      contactId: existingContact.id,
    });
    expect(res.status).toBe(200);
    expect(res.body.data.createdContact).toBe(false);

    const contact = await prisma.contact.findUniqueOrThrow({ where: { id: existingContact.id } });
    // Email was already set — never overwritten by the lead's different email.
    expect(contact.email).toBe('deepak.existing@example.com');
    // Phone was empty — filled in from the lead.
    expect(contact.phone).toBe('+919988776655');
    expect(contact.phoneNormalized).toBe(normalizePhone('+919988776655'));
    // The contact's company is never overwritten, even though a different
    // company (otherCompany) was linked on this conversion.
    expect(contact.companyId).toBe(originalCompany.id);
  });

  it('rejects converting a non-QUALIFIED lead (409)', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();
    const api = authed(app, token);

    const createRes = await api.post('/api/v1/leads', { companyName: 'Fixture Co',
      firstName: 'New Lead',
      email: 'new-lead@example.com',
      sourceId: tenant.leadSource.id,
    });
    const leadId = createRes.body.data.id as string;

    const res = await api.post(`/api/v1/leads/${leadId}/convert`, {});
    expect(res.status).toBe(409);
  });

  it('rejects converting an already-converted lead (409)', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();
    const api = authed(app, token);
    const leadId = await createQualifiedLead(api, tenant);

    const first = await api.post(`/api/v1/leads/${leadId}/convert`, {});
    expect(first.status).toBe(200);

    const second = await api.post(`/api/v1/leads/${leadId}/convert`, {});
    expect(second.status).toBe(409);
  });

  it('rejects converting an archived lead (409)', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();
    const api = authed(app, token);
    const leadId = await createQualifiedLead(api, tenant);

    const archiveRes = await api.post(`/api/v1/leads/${leadId}/archive`);
    expect(archiveRes.status).toBe(200);

    const res = await api.post(`/api/v1/leads/${leadId}/convert`, {});
    expect(res.status).toBe(409);
  });

  it('a forced mid-transaction failure leaves nothing behind, and the original lead and its history are intact', async () => {
    const tenant = await createTestTenant();
    const [otherTenant] = await createTwoTestTenants();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();
    const api = authed(app, token);
    const leadId = await createQualifiedLead(api, tenant);

    const companiesBefore = await prisma.company.count({ where: { organizationId: tenant.organization.id } });

    // No companyId -> a new company is created from the lead's own fields
    // (step 2 succeeds), but contactId points at another organisation's
    // contact, so step 3 fails with 404 — after step 2 already ran inside
    // the same transaction.
    const crossOrgContact = await prisma.contact.create({
      data: { organizationId: otherTenant.organization.id, firstName: 'Cross Org Contact' },
    });

    const res = await api.post(`/api/v1/leads/${leadId}/convert`, { contactId: crossOrgContact.id });
    expect(res.status).toBe(404);

    const companiesAfter = await prisma.company.count({ where: { organizationId: tenant.organization.id } });
    expect(companiesAfter).toBe(companiesBefore); // the new company was rolled back

    const conversions = await prisma.leadConversion.findMany({ where: { leadId } });
    expect(conversions).toEqual([]);

    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
    expect(lead.status).toBe('QUALIFIED'); // not CONVERTED — rolled back
    expect(lead.convertedAt).toBeNull();

    const history = await prisma.leadStatusHistory.findMany({ where: { leadId } });
    expect(history).toHaveLength(1); // only the original NEW -> QUALIFIED row
    expect(history[0]!.toStatus).toBe('QUALIFIED');
  });

  it('two concurrent conversion requests on the same lead produce exactly one conversion', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();
    const api = authed(app, token);
    const leadId = await createQualifiedLead(api, tenant);

    const [first, second] = await Promise.all([
      api.post(`/api/v1/leads/${leadId}/convert`, {}),
      api.post(`/api/v1/leads/${leadId}/convert`, {}),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([200, 409]);

    const conversions = await prisma.leadConversion.findMany({ where: { leadId } });
    expect(conversions).toHaveLength(1);
  });

  it('Staff can convert a lead (equal standing to Admin, D29)', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.staffUser.id);
    const app = createApp();
    const api = authed(app, token);
    const leadId = await createQualifiedLead(api, tenant);

    const res = await api.post(`/api/v1/leads/${leadId}/convert`, {});
    expect(res.status).toBe(200);
  });

  it('a lead in another organisation returns 404, not the record (cross-organisation isolation)', async () => {
    const [orgA, orgB] = await createTwoTestTenants();
    const { token } = await createSession(orgA.organization.id, orgA.adminUser.id);
    const app = createApp();
    const api = authed(app, token);
    const leadIdInOrgB = await createQualifiedLead(authed(app, (await createSession(orgB.organization.id, orgB.adminUser.id)).token), orgB);

    const res = await api.post(`/api/v1/leads/${leadIdInOrgB}/convert`, {});
    expect(res.status).toBe(404);
  });

  it('a companyId or contactId from another organisation is rejected (404), not silently linked', async () => {
    const [orgA, orgB] = await createTwoTestTenants();
    const { token } = await createSession(orgA.organization.id, orgA.adminUser.id);
    const app = createApp();
    const api = authed(app, token);
    const leadId = await createQualifiedLead(api, orgA);

    const crossOrgCompany = await prisma.company.create({
      data: { organizationId: orgB.organization.id, name: 'Org B Co', nameNormalized: 'org b co' },
    });

    const res = await api.post(`/api/v1/leads/${leadId}/convert`, { companyId: crossOrgCompany.id });
    expect(res.status).toBe(404);
  });

  it('GET conversion-matches suggests existing companies by normalised name and contacts by normalised email/phone, excluding archived', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();
    const api = authed(app, token);

    const matchingCompany = await prisma.company.create({
      data: { organizationId: tenant.organization.id, name: 'Example Foods Pvt Ltd', nameNormalized: 'example foods' },
    });
    const archivedCompany = await prisma.company.create({
      data: {
        organizationId: tenant.organization.id,
        name: 'Example Foods Archived',
        nameNormalized: 'example foods',
        archivedAt: new Date(),
      },
    });
    const matchingContact = await prisma.contact.create({
      data: {
        organizationId: tenant.organization.id,
        firstName: 'Asha',
        email: 'asha.rao@example.com',
        emailNormalized: normalizeEmail('asha.rao@example.com'),
      },
    });

    const leadId = await createQualifiedLead(api, tenant);

    const res = await api.get(`/api/v1/leads/${leadId}/conversion-matches`);
    expect(res.status).toBe(200);
    const companyIds = res.body.data.companies.map((c: { id: string }) => c.id);
    expect(companyIds).toContain(matchingCompany.id);
    expect(companyIds).not.toContain(archivedCompany.id);
    const contactIds = res.body.data.contacts.map((c: { id: string }) => c.id);
    expect(contactIds).toContain(matchingContact.id);
  });
});
