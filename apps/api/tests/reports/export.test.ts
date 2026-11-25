import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { REPORT_KEYS } from '@growspark/shared';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';
import { createTestTenant, createTwoTestTenants } from '../helpers/tenant.js';
import { signIn } from '../helpers/quotations.js';
import { pastMonth, seedActivity, seedCompany, seedContact, seedDeal, seedLead, seedQuotation } from '../helpers/reports.js';

const W = pastMonth();
const range = `from=${W.from}&to=${W.to}`;

/** The CSV as rows of cells (no quoted commas in these fixtures, except where a test says so). */
function parse(text: string): string[][] {
  return text.replace(/^\uFEFF/, '').trimEnd().split('\r\n').map((line) => line.split(','));
}

describe('Reports CSV export', () => {
  it('every report downloads as a BOM-led CSV with a resource-specific first header, a Total row and a descriptive filename', async () => {
    const tenant = await createTestTenant();
    const api = await signIn(createApp(), tenant, 'staff');
    const expectedFirstHeader: Record<string, string> = {
      'pipeline-by-stage': 'Stage',
      'lead-sources': 'Lead source',
      'sales-by-owner': 'Owner',
      quotations: 'Quotation status',
      'overdue-tasks': 'Assignee',
    };
    for (const report of REPORT_KEYS) {
      const res = await api.get(`/api/v1/reports/${report}/export?${range}`);
      expect(res.status, report).toBe(200);
      expect(res.headers['content-type']).toBe('text/csv; charset=utf-8');
      expect(res.headers['content-disposition']).toBe(`attachment; filename="report-${report}-${W.from}-to-${W.to}.csv"`);
      expect(res.text.charCodeAt(0)).toBe(0xfeff);
      expect(res.text.slice(1, 3)).not.toBe('ID');
      const rows = parse(res.text);
      expect(rows[0]![0]).toBe(expectedFirstHeader[report]);
      expect(rows.at(-1)![0]).toBe('Total');
    }
  });

  it('the CSV carries the same figures as the JSON report (sales by owner, with plain decimals and "Unassigned")', async () => {
    const tenant = await createTestTenant();
    const company = await seedCompany(tenant);
    await seedDeal(tenant, company.id, { value: '125000.50', status: 'WON', closedAt: W.on(3), ownerId: tenant.staffUser.id });
    await seedDeal(tenant, company.id, { value: '500.00', status: 'WON', closedAt: W.on(4), ownerId: null });
    await seedDeal(tenant, company.id, { value: '10.00', status: 'LOST', closedAt: W.on(5), ownerId: tenant.staffUser.id });
    const api = await signIn(createApp(), tenant);

    const rows = parse((await api.get(`/api/v1/reports/sales-by-owner/export?${range}`)).text);
    expect(rows).toEqual([
      ['Owner', 'Deals won', 'Won value (INR)', 'Deals lost', 'Win rate (%)'],
      ['Test Staff', '1', '125000.50', '1', '50.00'],
      ['Unassigned', '1', '500.00', '0', '100.00'],
      ['Total', '2', '125500.50', '1', '66.67'],
    ]);
  });

  it('quotations and overdue-task exports match their reports', async () => {
    const tenant = await createTestTenant();
    const company = await seedCompany(tenant);
    const contact = await seedContact(tenant, company.id);
    const day = (n: number) => `${W.from.slice(0, 8)}${String(n).padStart(2, '0')}`;
    await seedQuotation(tenant, { companyId: company.id, contactId: contact.id }, { issueDate: day(4), validUntil: day(9), total: '99.99', status: 'SENT' });
    const lead = await seedLead(tenant, { createdAt: W.before });
    await seedActivity(tenant, lead.id, { dueAt: W.on(5) });
    const api = await signIn(createApp(), tenant);

    expect(parse((await api.get(`/api/v1/reports/quotations/export?${range}`)).text)).toEqual([
      ['Quotation status', 'Quotations', 'Total value (INR)'],
      ['DRAFT', '0', '0.00'],
      ['SENT', '0', '0.00'],
      ['ACCEPTED', '0', '0.00'],
      ['REJECTED', '0', '0.00'],
      ['EXPIRED', '1', '99.99'],
      ['Total', '1', '99.99'],
    ]);
    expect(parse((await api.get(`/api/v1/reports/overdue-tasks/export?${range}`)).text)).toEqual([
      ['Assignee', 'Overdue tasks', 'Oldest due date'],
      ['Test Staff', '1', W.on(5).toISOString()],
      ['Total', '1', ''],
    ]);
  });

  it('respects scope=mine and adds it to the filename', async () => {
    const tenant = await createTestTenant();
    await seedLead(tenant, { createdAt: W.on(5), ownerId: tenant.adminUser.id });
    await seedLead(tenant, { createdAt: W.on(6), ownerId: tenant.staffUser.id });
    const res = await (await signIn(createApp(), tenant, 'staff')).get(`/api/v1/reports/lead-sources/export?${range}&scope=mine`);
    expect(res.headers['content-disposition']).toContain(`-to-${W.to}-mine.csv`);
    expect(parse(res.text).at(-1)).toEqual(['Total', '1', '0', '0.00']);
  });

  it('neutralises a formula in a name (lead source and owner names are user-entered)', async () => {
    const tenant = await createTestTenant();
    const evil = await prisma.leadSource.create({ data: { organizationId: tenant.organization.id, name: '=HYPERLINK("http://x")', sortOrder: 3 } });
    await seedLead(tenant, { createdAt: W.on(5), sourceId: evil.id });
    const text = (await (await signIn(createApp(), tenant)).get(`/api/v1/reports/lead-sources/export?${range}`)).text;
    expect(text).toContain(`"'=HYPERLINK(""http://x"")"`);
    expect(text).not.toMatch(/(^|\r\n|,)=HYPERLINK/);
  });

  it('an unknown report is a 422; signed-out is 401; another organisation\'s data never appears', async () => {
    const [orgA, orgB] = await createTwoTestTenants();
    await seedLead(orgB, { createdAt: W.on(5) });
    const api = await signIn(createApp(), orgA);
    expect((await api.get(`/api/v1/reports/everything/export?${range}`)).status).toBe(422);
    expect((await request(createApp()).get(`/api/v1/reports/lead-sources/export?${range}`)).status).toBe(401);
    expect(parse((await api.get(`/api/v1/reports/lead-sources/export?${range}`)).text)).toEqual([
      ['Lead source', 'Leads created', 'Converted', 'Conversion rate (%)'],
      ['Total', '0', '0', '0.00'],
    ]);
  });
});
