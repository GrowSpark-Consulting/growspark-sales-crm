import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';
import { createTestTenant } from '../helpers/tenant.js';
import { createQuotationContext, quotationBody, signIn } from '../helpers/quotations.js';

function todayKey(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

function dayOffset(days: number): Date {
  const date = new Date(`${todayKey()}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

/** A SENT quotation whose valid-until date is `validUntilOffset` days from today (negative = already lapsed). */
async function sentQuotation(validUntilOffset: number) {
  const tenant = await createTestTenant();
  const app = createApp();
  const api = await signIn(app, tenant);
  const context = await createQuotationContext(tenant);
  const { id } = (await api.post('/api/v1/quotations', quotationBody(context))).body.data;
  expect((await api.post(`/api/v1/quotations/${id}/status`, { status: 'SENT' })).status).toBe(200);
  await prisma.quotation.update({ where: { id }, data: { issueDate: dayOffset(-40), validUntil: dayOffset(validUntilOffset) } });
  return { tenant, app, api, id };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Quotation auto-expiry on read (D86)', () => {
  it('a SENT quotation past its valid-until date reads as EXPIRED and the flip is stored and audited as a system action', async () => {
    const { api, id } = await sentQuotation(-1);

    const res = await api.get(`/api/v1/quotations/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('EXPIRED');

    const stored = await prisma.quotation.findUniqueOrThrow({ where: { id } });
    expect(stored.status).toBe('EXPIRED');
    const audit = await prisma.auditEvent.findMany({ where: { entityId: id, action: 'quotation.expired' } });
    expect(audit).toHaveLength(1);
    expect(audit[0]!.actorId).toBeNull();
    expect(audit[0]!.metadata).toMatchObject({ fromStatus: 'SENT', toStatus: 'EXPIRED' });
  });

  it('is still SENT on its valid-until date itself', async () => {
    const { api, id } = await sentQuotation(0);
    expect((await api.get(`/api/v1/quotations/${id}`)).body.data.status).toBe('SENT');
    expect((await prisma.quotation.findUniqueOrThrow({ where: { id } })).status).toBe('SENT');
  });

  it('if the expiry write fails, the read still succeeds and still shows EXPIRED; list filter and detail agree', async () => {
    const { api, id } = await sentQuotation(-3);
    const failingWrite = vi.spyOn(prisma, '$transaction').mockRejectedValue(new Error('simulated database failure'));

    const detail = await api.get(`/api/v1/quotations/${id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.status).toBe('EXPIRED');

    const expiredList = await api.get('/api/v1/quotations?status=EXPIRED');
    expect(expiredList.status).toBe(200);
    expect(expiredList.body.data.map((q: { id: string }) => q.id)).toEqual([id]);
    expect(expiredList.body.data[0].status).toBe('EXPIRED');

    const sentList = await api.get('/api/v1/quotations?status=SENT');
    expect(sentList.status).toBe(200);
    expect(sentList.body.meta.total).toBe(0);

    const unfiltered = await api.get('/api/v1/quotations');
    expect(unfiltered.body.data[0].status).toBe('EXPIRED');

    expect(failingWrite).toHaveBeenCalled();
    // The write genuinely failed: the stored row is still SENT, and nothing was audited.
    expect((await prisma.quotation.findUniqueOrThrow({ where: { id } })).status).toBe('SENT');
    expect(await prisma.auditEvent.count({ where: { entityId: id, action: 'quotation.expired' } })).toBe(0);
  });

  it('list filter and detail agree once the write has succeeded too', async () => {
    const { api, id } = await sentQuotation(-1);
    const expiredList = await api.get('/api/v1/quotations?status=EXPIRED');
    expect(expiredList.body.data.map((q: { id: string }) => q.id)).toEqual([id]);
    expect((await api.get('/api/v1/quotations?status=SENT')).body.meta.total).toBe(0);
    expect((await api.get(`/api/v1/quotations/${id}`)).body.data.status).toBe('EXPIRED');
  });

  it('a lapsed quotation can no longer be accepted', async () => {
    const { api, id } = await sentQuotation(-1);
    const res = await api.post(`/api/v1/quotations/${id}/status`, { status: 'ACCEPTED' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_STATUS_TRANSITION');
    expect(res.body.error.message).toMatch(/expired/i);
  });

  it('concurrent reads flip and audit the row exactly once', async () => {
    const { api, id } = await sentQuotation(-2);
    const results = await Promise.all(Array.from({ length: 5 }, () => api.get(`/api/v1/quotations/${id}`)));
    expect(results.every((res) => res.status === 200 && res.body.data.status === 'EXPIRED')).toBe(true);
    expect(await prisma.auditEvent.count({ where: { entityId: id, action: 'quotation.expired' } })).toBe(1);
  });

  it('drafts never expire, whatever their dates', async () => {
    const tenant = await createTestTenant();
    const app = createApp();
    const api = await signIn(app, tenant);
    const context = await createQuotationContext(tenant);
    const { id } = (await api.post('/api/v1/quotations', quotationBody(context, { issueDate: '2025-01-01', validUntil: '2025-01-31' }))).body.data;
    expect((await api.get(`/api/v1/quotations/${id}`)).body.data.status).toBe('DRAFT');
  });
});
