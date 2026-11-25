import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { PERMISSIONS, ROLES, ROLE_PERMISSIONS, type SearchGroup } from '@growspark/shared';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';
import { createTestTenant, createTwoTestTenants, type TestTenant } from '../helpers/tenant.js';
import { createQuotationContext, quotationBody, signIn, type TestApp } from '../helpers/quotations.js';

/**
 * One organisation's worth of records all containing `word`: a lead, a
 * company + contact + deal (createQuotationContext) and a quotation, plus an
 * archived copy of each searchable type that must never be returned.
 */
async function seed(app: TestApp, tenant: TestTenant, word: string) {
  const admin = await signIn(app, tenant, 'admin');
  const lead = await admin.post('/api/v1/leads', {
    firstName: 'Asha',
    lastName: 'Rao',
    email: `asha.${word.toLowerCase()}@example.test`,
    companyName: `${word} Foods`,
    sourceId: tenant.leadSource.id,
  });
  expect(lead.status).toBe(201);
  const context = await createQuotationContext(tenant, `${word} Foods`);
  const quotation = await admin.post('/api/v1/quotations', quotationBody(context));
  expect(quotation.status).toBe(201);

  const organizationId = tenant.organization.id;
  const archivedAt = new Date();
  const archivedLead = await prisma.lead.create({
    data: { organizationId, firstName: `${word}Archived`, email: 'gone@example.test', emailNormalized: 'gone@example.test', sourceId: tenant.leadSource.id, archivedAt },
  });
  const archivedCompany = await prisma.company.create({
    data: { organizationId, name: `${word} Archived Co`, nameNormalized: `${word} archived co`.toLowerCase(), archivedAt },
  });
  const archivedContact = await prisma.contact.create({
    data: { organizationId, firstName: `${word}Gone`, email: 'gone2@example.test', emailNormalized: 'gone2@example.test', archivedAt },
  });
  const archivedDeal = await prisma.deal.create({
    data: {
      organizationId,
      name: `${word} archived deal`,
      companyId: archivedCompany.id,
      pipelineId: tenant.pipeline.id,
      stageId: tenant.stages[0]!.id,
      probability: 10,
      archivedAt,
    },
  });
  return {
    leadId: lead.body.data.id as string,
    companyId: context.company.id,
    contactId: context.contact.id,
    dealId: context.deal.id,
    quotationId: quotation.body.data.id as string,
    quotationNumber: quotation.body.data.number as string,
    archivedIds: [archivedLead.id, archivedCompany.id, archivedContact.id, archivedDeal.id],
  };
}

function idsOf(groups: SearchGroup[]): string[] {
  return groups.flatMap((group) => group.results.map((result) => result.id));
}

function group(groups: SearchGroup[], type: SearchGroup['type']) {
  return groups.find((g) => g.type === type);
}

describe('GET /api/v1/search', () => {
  it('requires a session, and at least 2 (at most 100) characters after trimming', async () => {
    const app = createApp();
    expect((await request(app).get('/api/v1/search?q=asha')).status).toBe(401);
    const tenant = await createTestTenant();
    const staff = await signIn(app, tenant, 'staff');
    expect((await staff.get('/api/v1/search?q=a')).status).toBe(422);
    expect((await staff.get('/api/v1/search?q=%20a%20')).status).toBe(422);
    expect((await staff.get('/api/v1/search')).status).toBe(422);
    expect((await staff.get(`/api/v1/search?q=${'x'.repeat(101)}`)).status).toBe(422);
    expect((await staff.get('/api/v1/search?q=ab')).status).toBe(200);
  });

  it('finds every record type for Staff, grouped in a fixed order, with links to the record and to the filtered list', async () => {
    const app = createApp();
    const tenant = await createTestTenant();
    const seeded = await seed(app, tenant, 'Zephyr');
    const staff = await signIn(app, tenant, 'staff');

    const res = await staff.get('/api/v1/search?q=zephyr');
    expect(res.status).toBe(200);
    const groups = res.body.data.groups as SearchGroup[];
    expect(groups.map((g) => g.type)).toEqual(['lead', 'contact', 'company', 'deal', 'quotation']);
    expect(group(groups, 'lead')!.results[0]).toEqual({
      id: seeded.leadId,
      title: 'Asha Rao',
      subtitle: 'Zephyr Foods · asha.zephyr@example.test',
      href: `/leads/${seeded.leadId}`,
    });
    // The contact (Asha Rao, asha@example.test) matches through its company's name.
    expect(group(groups, 'contact')!.results.map((r) => r.id)).toEqual([seeded.contactId]);
    expect(group(groups, 'company')!.results.map((r) => r.id)).toEqual([seeded.companyId]);
    expect(group(groups, 'deal')!.results[0]).toMatchObject({ id: seeded.dealId, subtitle: 'Zephyr Foods · Qualification' });
    expect(group(groups, 'quotation')!.results[0]).toMatchObject({ id: seeded.quotationId, title: seeded.quotationNumber });
    expect(group(groups, 'lead')!.seeAllHref).toBe('/leads?q=zephyr');
    expect(groups.every((g) => g.hasMore === false)).toBe(true);
  });

  it('matches every word against any field ("asha rao", "rao zephyr"), case-insensitively, and by quotation number', async () => {
    const app = createApp();
    const tenant = await createTestTenant();
    const seeded = await seed(app, tenant, 'Quill');
    const staff = await signIn(app, tenant, 'staff');

    const both = (await staff.get('/api/v1/search?q=ASHA%20rao')).body.data.groups as SearchGroup[];
    expect(group(both, 'lead')!.results.map((r) => r.id)).toEqual([seeded.leadId]);
    const mixed = (await staff.get('/api/v1/search?q=rao%20quill')).body.data.groups as SearchGroup[];
    expect(group(mixed, 'lead')!.results.map((r) => r.id)).toEqual([seeded.leadId]);
    // A word that matches nothing removes the lead.
    const miss = (await staff.get('/api/v1/search?q=asha%20nobody')).body.data.groups as SearchGroup[];
    expect(group(miss, 'lead')).toBeUndefined();

    const byNumber = (await staff.get(`/api/v1/search?q=${seeded.quotationNumber}`)).body.data.groups as SearchGroup[];
    expect(group(byNumber, 'quotation')!.results.map((r) => r.id)).toEqual([seeded.quotationId]);
  });

  it('never returns another organisation’s records or an archived record (breaks without the scoping)', async () => {
    const app = createApp();
    const [a, b] = await createTwoTestTenants();
    const seededA = await seed(app, a, 'Orchid');
    const seededB = await seed(app, b, 'Orchid');
    const staffA = await signIn(app, a, 'staff');

    const groups = (await staffA.get('/api/v1/search?q=orchid')).body.data.groups as SearchGroup[];
    const ids = idsOf(groups);
    expect(ids.sort()).toEqual(
      [seededA.leadId, seededA.contactId, seededA.companyId, seededA.dealId, seededA.quotationId].sort(),
    );
    for (const id of [seededB.leadId, seededB.contactId, seededB.companyId, seededB.dealId, seededB.quotationId]) {
      expect(ids).not.toContain(id);
    }
    for (const id of [...seededA.archivedIds, ...seededB.archivedIds]) expect(ids).not.toContain(id);
  });

  it('shows at most 5 per group and says when there are more', async () => {
    const app = createApp();
    const tenant = await createTestTenant();
    const admin = await signIn(app, tenant, 'admin');
    for (let i = 0; i < 7; i += 1) {
      const res = await admin.post('/api/v1/leads', { companyName: 'Fixture Co', firstName: `Banyan${i}`, email: `b${i}@example.test`, sourceId: tenant.leadSource.id });
      expect(res.status).toBe(201);
    }
    const groups = (await admin.get('/api/v1/search?q=banyan')).body.data.groups as SearchGroup[];
    expect(group(groups, 'lead')!.results).toHaveLength(5);
    expect(group(groups, 'lead')!.hasMore).toBe(true);
  });

  it('treats % and _ as ordinary characters, not wildcards', async () => {
    const app = createApp();
    const tenant = await createTestTenant();
    await seed(app, tenant, 'Lotus');
    const staff = await signIn(app, tenant, 'staff');
    for (const q of ['%%', '__', '%_']) {
      const res = await staff.get(`/api/v1/search?q=${encodeURIComponent(q)}`);
      expect(res.status).toBe(200);
      expect(res.body.data.groups, q).toEqual([]);
    }
  });

  it('a group disappears when the role loses that read permission (breaks without the per-group check)', async () => {
    const app = createApp();
    const tenant = await createTestTenant();
    await seed(app, tenant, 'Cedar');
    const staff = await signIn(app, tenant, 'staff');

    const staffPermissions = ROLE_PERMISSIONS[ROLES.STAFF] as unknown as string[];
    const removed = [PERMISSIONS.QUOTATIONS_READ, PERMISSIONS.DEALS_READ];
    const original = [...staffPermissions];
    try {
      for (const permission of removed) staffPermissions.splice(staffPermissions.indexOf(permission), 1);
      const groups = (await staff.get('/api/v1/search?q=cedar')).body.data.groups as SearchGroup[];
      expect(groups.map((g) => g.type)).toEqual(['lead', 'contact', 'company']);
    } finally {
      staffPermissions.splice(0, staffPermissions.length, ...original);
    }
    const restored = (await staff.get('/api/v1/search?q=cedar')).body.data.groups as SearchGroup[];
    expect(restored.map((g) => g.type)).toEqual(['lead', 'contact', 'company', 'deal', 'quotation']);
  });

  it('does not run the quotation auto-expiry write (search is read-only)', async () => {
    const app = createApp();
    const tenant = await createTestTenant();
    const seeded = await seed(app, tenant, 'Maple');
    await prisma.quotation.update({
      where: { id: seeded.quotationId },
      data: { status: 'SENT', sentAt: new Date(), issueDate: new Date('2020-01-01'), validUntil: new Date('2020-01-31') },
    });
    const staff = await signIn(app, tenant, 'staff');
    const res = await staff.get('/api/v1/search?q=maple');
    expect(group(res.body.data.groups, 'quotation')!.results[0]!.id).toBe(seeded.quotationId);
    const stored = await prisma.quotation.findUniqueOrThrow({ where: { id: seeded.quotationId } });
    expect(stored.status).toBe('SENT');
    expect(await prisma.auditEvent.count({ where: { organizationId: tenant.organization.id, action: 'quotation.expired' } })).toBe(0);
  });
});
