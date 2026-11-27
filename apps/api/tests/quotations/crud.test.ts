import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';
import { createTestTenant, createTwoTestTenants } from '../helpers/tenant.js';
import { createQuotationContext, quotationBody, signIn, AWKWARD_LINES } from '../helpers/quotations.js';
import * as quotationsService from '../../src/modules/quotations/quotations.service.js';
import { toSharedRole } from '../../src/lib/context.js';

function todayKey(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

function addDays(key: string, days: number): string {
  const date = new Date(`${key}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

describe('Quotations: create and read', () => {
  it('creates a draft with a Q-YYYY-0001 number, server-computed totals, defaults and line items', async () => {
    const tenant = await createTestTenant();
    const app = createApp();
    const api = await signIn(app, tenant);
    const context = await createQuotationContext(tenant);

    const res = await api.post('/api/v1/quotations', quotationBody(context, { terms: 'Net 30', notes: 'Thanks' }));
    expect(res.status).toBe(201);
    const q = res.body.data;
    const year = todayKey().slice(0, 4);
    expect(q.number).toBe(`Q-${year}-0001`);
    expect(q.version).toBe(1);
    expect(q.pdfReference).toBe(`Q-${year}-0001-v1`);
    expect(q.status).toBe('DRAFT');
    expect(q.currency).toBe('INR');
    expect(q.ownerId).toBe(tenant.adminUser.id);
    expect(q.companyName).toBe('Example Foods');
    expect(q.contactName).toBe('Asha Rao');
    expect(q.dealName).toBe('Example Foods automation');
    expect(q.issueDate).toBe(todayKey());
    expect(q.validUntil).toBe(addDays(todayKey(), 30));
    expect(q.pricesIncludeTax).toBe(false);
    // 2 × 45,000 less 10% = 81,000; + 1,25,000 = 2,06,000; GST 18% = 37,080
    expect(q).toMatchObject({ subtotal: '206000.00', taxAmount: '37080.00', total: '243080.00', gstBreakdown: [{ rate: '18', taxable: '206000.00', gst: '37080.00' }] });
    expect(q).not.toHaveProperty('discountPercent');
    expect(q).not.toHaveProperty('taxPercent');
    expect(q).not.toHaveProperty('discountAmount');
    expect(q.lineItems).toHaveLength(2);
    expect(q.lineItems[0]).toMatchObject({
      position: 1, quantity: '2.00', unitPrice: '45000.00', discountPercent: '10.00', gstPercent: '18.00', taxableAmount: '81000.00', gstAmount: '14580.00', lineTotal: '95580.00',
    });
    expect(q.terms).toBe('Net 30');

    const getRes = await api.get(`/api/v1/quotations/${q.id}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.total).toBe('243080.00');
  });

  it('ignores any totals the client sends and recomputes them (awkward numbers: 3 × 0.10, 33.33% line discount, 18%)', async () => {
    const tenant = await createTestTenant();
    const app = createApp();
    const api = await signIn(app, tenant);
    const context = await createQuotationContext(tenant);

    const res = await api.post('/api/v1/quotations', {
      ...quotationBody(context),
      lineItems: AWKWARD_LINES,
      subtotal: '1.00',
      total: '999.99',
    });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ subtotal: '0.20', taxAmount: '0.04', total: '0.24' });

    const stored = await prisma.quotation.findUniqueOrThrow({ where: { id: res.body.data.id } });
    expect(stored.total.toFixed(2)).toBe('0.24');
  });

  it('POST /quotations/calculate returns the same totals without saving anything', async () => {
    const tenant = await createTestTenant();
    const app = createApp();
    const api = await signIn(app, tenant, 'staff');

    const res = await api.post('/api/v1/quotations/calculate', {
      lineItems: [{ description: 'x', quantity: '3', unitPrice: '33.33', discountPercent: '33.33', gstPercent: '18' }],
    });
    expect(res.status).toBe(200);
    // 99.99 less 33.33% = 66.66; GST 18% = 11.9988 -> 12.00; total 78.66
    expect(res.body.data).toEqual({
      lineTotals: ['78.66'], subtotal: '66.66', gstBreakdown: [{ rate: '18', taxable: '66.66', gst: '12.00' }], taxAmount: '12.00', total: '78.66',
    });
    expect(await prisma.quotation.count()).toBe(0);
  });

  it('GST is per line: any rate 0–100 with 2 decimals, one breakdown row per rate, a missing rate defaults to 18', async () => {
    const tenant = await createTestTenant();
    const app = createApp();
    const api = await signIn(app, tenant);
    const context = await createQuotationContext(tenant);

    const res = await api.post('/api/v1/quotations', quotationBody(context, {
      lineItems: [
        { description: 'Five', quantity: '1', unitPrice: '1000.00', gstPercent: '5' },
        { description: 'Exempt', quantity: '1', unitPrice: '300.00', gstPercent: '0' },
        { description: 'Odd', quantity: '2', unitPrice: '500.00', gstPercent: '12.5' },
        { description: 'Quarter', quantity: '1', unitPrice: '1000.00', gstPercent: 0.25 },
        { description: 'Default', quantity: '1', unitPrice: '100.00' },
      ],
    }));
    expect(res.status).toBe(201);
    const q = res.body.data;
    expect(q.lineItems.map((item: { gstPercent: string }) => item.gstPercent)).toEqual(['5.00', '0.00', '12.50', '0.25', '18.00']);
    expect(q.gstBreakdown).toEqual([
      { rate: '0', taxable: '300.00', gst: '0.00' },
      { rate: '0.25', taxable: '1000.00', gst: '2.50' },
      { rate: '5', taxable: '1000.00', gst: '50.00' },
      { rate: '12.5', taxable: '1000.00', gst: '125.00' },
      { rate: '18', taxable: '100.00', gst: '18.00' },
    ]);
    expect(q).toMatchObject({ subtotal: '3400.00', taxAmount: '195.50', total: '3595.50' });
  });

  it('the inclusive/exclusive toggle is stored, changes the maths, and can be switched while the quotation is a draft', async () => {
    const tenant = await createTestTenant();
    const app = createApp();
    const api = await signIn(app, tenant);
    const context = await createQuotationContext(tenant);
    const lineItems = [{ description: 'Workshop', quantity: '1', unitPrice: '1000.00', gstPercent: '18' }];

    const exclusive = (await api.post('/api/v1/quotations', quotationBody(context, { lineItems }))).body.data;
    expect(exclusive).toMatchObject({ pricesIncludeTax: false, subtotal: '1000.00', taxAmount: '180.00', total: '1180.00' });

    const inclusive = (await api.post('/api/v1/quotations', quotationBody(context, { lineItems, pricesIncludeTax: true }))).body.data;
    expect(inclusive).toMatchObject({ pricesIncludeTax: true, subtotal: '847.46', taxAmount: '152.54', total: '1000.00' });
    expect(inclusive.lineItems[0]).toMatchObject({ taxableAmount: '847.46', gstAmount: '152.54', lineTotal: '1000.00' });

    // Switching the toggle alone on a draft re-runs the maths over the stored lines.
    const switched = await api.patch(`/api/v1/quotations/${exclusive.id}`, { pricesIncludeTax: true });
    expect(switched.status).toBe(200);
    expect(switched.body.data).toMatchObject({ pricesIncludeTax: true, subtotal: '847.46', taxAmount: '152.54', total: '1000.00', version: 2 });
    const stored = await prisma.quotation.findUniqueOrThrow({ where: { id: exclusive.id } });
    expect(stored.pricesIncludeTax).toBe(true);
  });

  it('a retired quotation-level discount or GST sent by an old client is ignored, never applied', async () => {
    const tenant = await createTestTenant();
    const app = createApp();
    const api = await signIn(app, tenant);
    const context = await createQuotationContext(tenant);
    const res = await api.post('/api/v1/quotations', quotationBody(context, {
      lineItems: [{ description: 'x', quantity: '1', unitPrice: '1000.00', gstPercent: '18' }],
      discountPercent: '50',
      taxPercent: '28',
    }));
    expect(res.status).toBe(201);
    expect(res.body.data.total).toBe('1180.00');
  });

  it('numbers are sequential per organisation and never collide under concurrent creates', async () => {
    const [tenantA, tenantB] = await createTwoTestTenants();
    const app = createApp();
    const apiA = await signIn(app, tenantA);
    const apiB = await signIn(app, tenantB);
    const contextA = await createQuotationContext(tenantA);
    const contextB = await createQuotationContext(tenantB);

    const results = await Promise.all(Array.from({ length: 8 }, () => apiA.post('/api/v1/quotations', quotationBody(contextA))));
    expect(results.every((res) => res.status === 201)).toBe(true);
    const numbers = results.map((res) => res.body.data.number as string).sort();
    const year = todayKey().slice(0, 4);
    expect(numbers).toEqual(Array.from({ length: 8 }, (_, index) => `Q-${year}-${String(index + 1).padStart(4, '0')}`));

    // Organisation B has its own sequence.
    const resB = await apiB.post('/api/v1/quotations', quotationBody(contextB));
    expect(resB.body.data.number).toBe(`Q-${year}-0001`);
  });

  it('the counter restarts at 0001 in a new calendar year', async () => {
    const tenant = await createTestTenant();
    const context = await createQuotationContext(tenant);
    const ctx = { userId: tenant.adminUser.id, orgId: tenant.organization.id, role: toSharedRole(tenant.adminUser.role) };
    const body = quotationBody(context) as never;

    const late2026 = await quotationsService.createQuotation(ctx, body, new Date('2026-12-31T10:00:00.000Z'));
    const again2026 = await quotationsService.createQuotation(ctx, body, new Date('2026-12-31T12:00:00.000Z'));
    // 2026-12-31T20:00Z is already 1 Jan 2027 in Asia/Kolkata (UTC+5:30).
    const early2027 = await quotationsService.createQuotation(ctx, body, new Date('2026-12-31T20:00:00.000Z'));
    expect([late2026.number, again2026.number, early2027.number]).toEqual(['Q-2026-0001', 'Q-2026-0002', 'Q-2027-0001']);
  });

  it('validates relationships: other-company contact or deal is 422, another organisation\'s company is 404', async () => {
    const [tenant, other] = await createTwoTestTenants();
    const app = createApp();
    const api = await signIn(app, tenant);
    const context = await createQuotationContext(tenant);
    const second = await createQuotationContext(tenant, 'Second Co');
    const foreign = await createQuotationContext(other, 'Foreign Co');

    const wrongContact = await api.post('/api/v1/quotations', quotationBody(context, { contactId: second.contact.id }));
    expect(wrongContact.status).toBe(422);
    const wrongDeal = await api.post('/api/v1/quotations', quotationBody(context, { dealId: second.deal.id }));
    expect(wrongDeal.status).toBe(422);
    const foreignCompany = await api.post('/api/v1/quotations', quotationBody(foreign));
    expect(foreignCompany.status).toBe(404);
  });

  it('rejects bad input: no line items, >2 decimals, percentages over 100, valid-until before issue date', async () => {
    const tenant = await createTestTenant();
    const app = createApp();
    const api = await signIn(app, tenant);
    const context = await createQuotationContext(tenant);

    expect((await api.post('/api/v1/quotations', quotationBody(context, { lineItems: [] }))).status).toBe(422);
    expect((await api.post('/api/v1/quotations', quotationBody(context, { lineItems: [{ description: 'x', quantity: '1', unitPrice: '1.005' }] }))).status).toBe(422);
    expect((await api.post('/api/v1/quotations', quotationBody(context, { lineItems: [{ description: 'x', quantity: '0', unitPrice: '1' }] }))).status).toBe(422);
    expect((await api.post('/api/v1/quotations', quotationBody(context, { lineItems: [{ description: 'x', quantity: '1', unitPrice: '1', gstPercent: '100.01' }] }))).status).toBe(422);
    expect((await api.post('/api/v1/quotations', quotationBody(context, { lineItems: [{ description: 'x', quantity: '1', unitPrice: '1', gstPercent: '-1' }] }))).status).toBe(422);
    expect((await api.post('/api/v1/quotations', quotationBody(context, { lineItems: [{ description: 'x', quantity: '1', unitPrice: '1', gstPercent: '18.005' }] }))).status).toBe(422);
    expect((await api.post('/api/v1/quotations', quotationBody(context, { lineItems: [{ description: 'x', quantity: '1', unitPrice: '1', discountPercent: '100.5' }] }))).status).toBe(422);
    expect((await api.post('/api/v1/quotations', quotationBody(context, { pricesIncludeTax: 'yes' }))).status).toBe(422);
    expect((await api.post('/api/v1/quotations', quotationBody(context, { issueDate: '2026-11-20', validUntil: '2026-11-19' }))).status).toBe(422);
    expect(await prisma.quotation.count()).toBe(0);
  });
});

describe('Quotations: edit, status, duplicate, archive', () => {
  it('edits a draft, replaces line items, recomputes totals and bumps the version', async () => {
    const tenant = await createTestTenant();
    const app = createApp();
    const api = await signIn(app, tenant);
    const context = await createQuotationContext(tenant);
    const created = (await api.post('/api/v1/quotations', quotationBody(context))).body.data;

    const res = await api.patch(`/api/v1/quotations/${created.id}`, {
      lineItems: [{ description: 'Only line', quantity: '3', unitPrice: '33.33', discountPercent: '33.33', gstPercent: '18' }],
      notes: 'Revised',
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ version: 2, pdfReference: `${created.number}-v2`, total: '78.66', notes: 'Revised' });
    expect(res.body.data.lineItems).toHaveLength(1);
    expect(await prisma.quotationLineItem.count({ where: { quotationId: created.id } })).toBe(1);
  });

  it('enforces the status flow on the server', async () => {
    const tenant = await createTestTenant();
    const app = createApp();
    const api = await signIn(app, tenant, 'staff');
    const context = await createQuotationContext(tenant);
    const { id } = (await api.post('/api/v1/quotations', quotationBody(context))).body.data;

    expect((await api.post(`/api/v1/quotations/${id}/status`, { status: 'ACCEPTED' })).status).toBe(409);
    expect((await api.post(`/api/v1/quotations/${id}/status`, { status: 'EXPIRED' })).status).toBe(422);

    const sent = await api.post(`/api/v1/quotations/${id}/status`, { status: 'SENT' });
    expect(sent.status).toBe(200);
    expect(sent.body.data.status).toBe('SENT');
    expect(sent.body.data.sentAt).not.toBeNull();

    const edit = await api.patch(`/api/v1/quotations/${id}`, { notes: 'too late' });
    expect(edit.status).toBe(409);

    expect((await api.post(`/api/v1/quotations/${id}/status`, { status: 'ACCEPTED' })).status).toBe(200);
    const again = await api.post(`/api/v1/quotations/${id}/status`, { status: 'REJECTED' });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('refuses to send a draft whose valid-until date has passed, until the date is changed', async () => {
    const tenant = await createTestTenant();
    const app = createApp();
    const api = await signIn(app, tenant);
    const context = await createQuotationContext(tenant);
    const yesterday = addDays(todayKey(), -1);
    const { id } = (await api.post('/api/v1/quotations', quotationBody(context, { issueDate: addDays(todayKey(), -30), validUntil: yesterday }))).body.data;

    const refused = await api.post(`/api/v1/quotations/${id}/status`, { status: 'SENT' });
    expect(refused.status).toBe(409);
    expect(refused.body.error).toMatchObject({ code: 'VALID_UNTIL_PASSED', message: 'Valid-until date has passed, change it first.' });
    const stored = await prisma.quotation.findUniqueOrThrow({ where: { id } });
    expect(stored.status).toBe('DRAFT');
    expect(stored.sentAt).toBeNull();
    expect(await prisma.auditEvent.count({ where: { entityId: id, action: 'quotation.status_changed' } })).toBe(0);

    // Valid until today is still fine (a quotation is valid on its valid-until date).
    expect((await api.patch(`/api/v1/quotations/${id}`, { validUntil: todayKey() })).status).toBe(200);
    const sent = await api.post(`/api/v1/quotations/${id}/status`, { status: 'SENT' });
    expect(sent.status).toBe(200);
    expect(sent.body.data.status).toBe('SENT');
  });

  it('duplicate: new number, Draft, new dates, same company/contact/deal, same lines and totals, caller as owner', async () => {
    const tenant = await createTestTenant();
    const app = createApp();
    const admin = await signIn(app, tenant);
    const staff = await signIn(app, tenant, 'staff');
    const context = await createQuotationContext(tenant);
    const source = (
      await admin.post('/api/v1/quotations', quotationBody(context, { issueDate: '2026-01-05', validUntil: '2026-01-20', pricesIncludeTax: true, terms: 'Net 30' }))
    ).body.data;
    await admin.post(`/api/v1/quotations/${source.id}/status`, { status: 'SENT' });
    await admin.post(`/api/v1/quotations/${source.id}/archive`);

    const res = await staff.post(`/api/v1/quotations/${source.id}/duplicate`);
    expect(res.status).toBe(201);
    const copy = res.body.data;
    expect(copy.id).not.toBe(source.id);
    expect(copy.number).not.toBe(source.number);
    expect(copy.version).toBe(1);
    expect(copy.status).toBe('DRAFT');
    expect(copy.sentAt).toBeNull();
    expect(copy.archivedAt).toBeNull();
    expect(copy.issueDate).toBe(todayKey());
    expect(copy.validUntil).toBe(addDays(todayKey(), 30));
    expect(copy.companyId).toBe(context.company.id);
    expect(copy.contactId).toBe(context.contact.id);
    expect(copy.dealId).toBe(context.deal.id);
    expect(copy.ownerId).toBe(tenant.staffUser.id);
    expect(copy.terms).toBe('Net 30');
    expect(copy).toMatchObject({ pricesIncludeTax: true, subtotal: source.subtotal, taxAmount: source.taxAmount, total: source.total, gstBreakdown: source.gstBreakdown });
    type Line = { description: string; gstPercent: string; discountPercent: string; taxableAmount: string; gstAmount: string; lineTotal: string };
    const pick = (item: Line) => [item.description, item.gstPercent, item.discountPercent, item.taxableAmount, item.gstAmount, item.lineTotal];
    expect(copy.lineItems.map(pick)).toEqual(source.lineItems.map(pick));

    const audit = await prisma.auditEvent.findFirstOrThrow({ where: { entityId: copy.id, action: 'quotation.duplicated' } });
    expect(audit.actorId).toBe(tenant.staffUser.id);
    expect(audit.metadata).toMatchObject({ number: copy.number, duplicatedFromNumber: source.number });
  });

  it('archive hides from the default list, restore brings it back, repeats are 409, archived status cannot change', async () => {
    const tenant = await createTestTenant();
    const app = createApp();
    const api = await signIn(app, tenant);
    const context = await createQuotationContext(tenant);
    const { id } = (await api.post('/api/v1/quotations', quotationBody(context))).body.data;

    expect((await api.post(`/api/v1/quotations/${id}/archive`)).status).toBe(200);
    expect((await api.post(`/api/v1/quotations/${id}/archive`)).status).toBe(409);
    expect((await api.get('/api/v1/quotations')).body.meta.total).toBe(0);
    expect((await api.get('/api/v1/quotations?archived=true')).body.meta.total).toBe(1);
    expect((await api.post(`/api/v1/quotations/${id}/status`, { status: 'SENT' })).status).toBe(409);
    expect((await api.post(`/api/v1/quotations/${id}/restore`)).status).toBe(200);
    expect((await api.post(`/api/v1/quotations/${id}/restore`)).status).toBe(409);
    expect((await api.get('/api/v1/quotations')).body.meta.total).toBe(1);
  });
});

describe('Quotations: list filters, permissions, isolation, audit', () => {
  it('filters by search, status, company, deal, owner and issue-date range, and sorts by total', async () => {
    const tenant = await createTestTenant();
    const app = createApp();
    const admin = await signIn(app, tenant);
    const staff = await signIn(app, tenant, 'staff');
    const foods = await createQuotationContext(tenant, 'Example Foods');
    const steel = await createQuotationContext(tenant, 'Sample Steel');

    const small = (await admin.post('/api/v1/quotations', quotationBody(foods, { lineItems: AWKWARD_LINES, issueDate: '2026-03-01', validUntil: '2026-12-31' }))).body.data;
    const large = (await staff.post('/api/v1/quotations', quotationBody(steel, { dealId: null, issueDate: '2026-06-01', validUntil: '2026-12-31' }))).body.data;
    await admin.post(`/api/v1/quotations/${large.id}/status`, { status: 'SENT' });

    const ids = async (query: string) => (await admin.get(`/api/v1/quotations?${query}`)).body.data.map((q: { id: string }) => q.id);
    expect(await ids('q=steel')).toEqual([large.id]);
    expect(await ids(`q=${small.number}`)).toEqual([small.id]);
    expect(await ids('status=DRAFT')).toEqual([small.id]);
    expect(await ids(`companyId=${steel.company.id}`)).toEqual([large.id]);
    expect(await ids(`dealId=${foods.deal.id}`)).toEqual([small.id]);
    expect(await ids(`ownerId=${tenant.staffUser.id}`)).toEqual([large.id]);
    expect(await ids('issuedFrom=2026-05-01&issuedTo=2026-06-30')).toEqual([large.id]);
    expect(await ids('sort=total:desc')).toEqual([large.id, small.id]);
    expect(await ids('sort=total:asc')).toEqual([small.id, large.id]);
    expect((await admin.get('/api/v1/quotations?sort=bogus:asc')).status).toBe(422);
  });

  it('requires a session, and treats another organisation\'s quotation as not found', async () => {
    const [tenant, other] = await createTwoTestTenants();
    const app = createApp();
    const api = await signIn(app, tenant);
    const otherApi = await signIn(app, other);
    const context = await createQuotationContext(tenant);
    const { id } = (await api.post('/api/v1/quotations', quotationBody(context))).body.data;

    expect((await request(app).get('/api/v1/quotations')).status).toBe(401);
    expect((await request(app).get(`/api/v1/quotations/${id}`)).status).toBe(401);
    expect((await otherApi.get(`/api/v1/quotations/${id}`)).status).toBe(404);
    expect((await otherApi.patch(`/api/v1/quotations/${id}`, { notes: 'x' })).status).toBe(404);
    expect((await otherApi.post(`/api/v1/quotations/${id}/duplicate`)).status).toBe(404);
    expect((await otherApi.get('/api/v1/quotations')).body.meta.total).toBe(0);
  });

  it('writes an audit row per action, with only allowlisted metadata visible through the audit API', async () => {
    const tenant = await createTestTenant();
    const app = createApp();
    const api = await signIn(app, tenant);
    const context = await createQuotationContext(tenant);
    const { id, number } = (await api.post('/api/v1/quotations', quotationBody(context))).body.data;
    await api.patch(`/api/v1/quotations/${id}`, { notes: 'x' });
    await api.post(`/api/v1/quotations/${id}/status`, { status: 'SENT' });
    await api.post(`/api/v1/quotations/${id}/archive`);
    await api.post(`/api/v1/quotations/${id}/restore`);

    const rows = await prisma.auditEvent.findMany({ where: { entityId: id }, orderBy: { createdAt: 'asc' } });
    expect(rows.map((row) => row.action)).toEqual([
      'quotation.created',
      'quotation.updated',
      'quotation.status_changed',
      'quotation.archived',
      'quotation.restored',
    ]);
    expect(rows.every((row) => row.actorId === tenant.adminUser.id)).toBe(true);

    const auditRes = await api.get('/api/v1/audit-events?entityType=quotation&pageSize=50');
    expect(auditRes.status).toBe(200);
    const created = auditRes.body.data.find((row: { action: string }) => row.action === 'quotation.created');
    expect(created.metadata).toEqual({ number, companyId: context.company.id, contactId: context.contact.id, dealId: context.deal.id, total: '243080.00', pricesIncludeTax: false });
    const statusRow = auditRes.body.data.find((row: { action: string }) => row.action === 'quotation.status_changed');
    expect(statusRow.metadata).toEqual({ number, fromStatus: 'DRAFT', toStatus: 'SENT' });
  });
});
