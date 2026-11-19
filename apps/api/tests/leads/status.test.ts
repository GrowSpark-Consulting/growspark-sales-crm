import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';
import { createTestTenant } from '../helpers/tenant.js';
import { createSession } from '../../src/lib/session.js';
import { ALLOWED_ORIGIN, sessionCookieHeader } from '../helpers/http.js';

function authed(app: ReturnType<typeof createApp>, token: string) {
  const cookie = sessionCookieHeader(token);
  return {
    post: (path: string, body?: object) =>
      request(app).post(path).set('Origin', ALLOWED_ORIGIN).set('Cookie', cookie).send(body ?? {}),
  };
}

async function createLead(api: ReturnType<typeof authed>, sourceId: string, email: string) {
  const res = await api.post('/api/v1/leads', { firstName: 'Test', email, sourceId });
  return res.body.data.id as string;
}

describe('Lead status workflow (D29)', () => {
  it('moves freely between any two open statuses, writing a LeadStatusHistory row each time', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();
    const api = authed(app, token);
    const leadId = await createLead(api, tenant.leadSource.id, 'status1@example.com');

    const toQualified = await api.post(`/api/v1/leads/${leadId}/status`, { status: 'QUALIFIED' });
    expect(toQualified.status).toBe(200);
    expect(toQualified.body.data.status).toBe('QUALIFIED');

    // Not a linear pipeline: QUALIFIED -> NEW directly is allowed.
    const backToNew = await api.post(`/api/v1/leads/${leadId}/status`, { status: 'NEW' });
    expect(backToNew.status).toBe(200);
    expect(backToNew.body.data.status).toBe('NEW');

    const toUnqualified = await api.post(`/api/v1/leads/${leadId}/status`, { status: 'UNQUALIFIED' });
    expect(toUnqualified.status).toBe(200);

    const history = await prisma.leadStatusHistory.findMany({
      where: { leadId },
      orderBy: { createdAt: 'asc' },
    });
    expect(history.map((h) => [h.fromStatus, h.toStatus])).toEqual([
      ['NEW', 'QUALIFIED'],
      ['QUALIFIED', 'NEW'],
      ['NEW', 'UNQUALIFIED'],
    ]);
    expect(history.every((h) => h.changedById === tenant.adminUser.id)).toBe(true);
  });

  it('rejects CONVERTED as a target status through the normal endpoint (422)', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();
    const api = authed(app, token);
    const leadId = await createLead(api, tenant.leadSource.id, 'status2@example.com');

    const res = await api.post(`/api/v1/leads/${leadId}/status`, { status: 'CONVERTED' });
    expect(res.status).toBe(422);

    const history = await prisma.leadStatusHistory.findMany({ where: { leadId } });
    expect(history).toEqual([]);
  });

  it('rejects any status change once a lead is already CONVERTED (409)', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();
    const api = authed(app, token);
    const leadId = await createLead(api, tenant.leadSource.id, 'status3@example.com');

    // No convert action exists yet (Day 3) — simulate the post-conversion
    // state directly, the only way to reach it before that package exists.
    await prisma.lead.update({ where: { id: leadId }, data: { status: 'CONVERTED', convertedAt: new Date() } });

    const res = await api.post(`/api/v1/leads/${leadId}/status`, { status: 'QUALIFIED' });
    expect(res.status).toBe(409);
  });

  it('rejects an unknown status value (422)', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();
    const api = authed(app, token);
    const leadId = await createLead(api, tenant.leadSource.id, 'status4@example.com');

    const res = await api.post(`/api/v1/leads/${leadId}/status`, { status: 'BOGUS' });
    expect(res.status).toBe(422);
  });

  it('GET /api/v1/leads/:id/status-history returns rows newest first', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();
    const api = authed(app, token);
    const leadId = await createLead(api, tenant.leadSource.id, 'status5@example.com');

    await api.post(`/api/v1/leads/${leadId}/status`, { status: 'CONTACTED' });
    await api.post(`/api/v1/leads/${leadId}/status`, { status: 'QUALIFIED' });

    const res = await request(app)
      .get(`/api/v1/leads/${leadId}/status-history`)
      .set('Cookie', sessionCookieHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.data.map((h: { toStatus: string }) => h.toStatus)).toEqual(['QUALIFIED', 'CONTACTED']);
    expect(res.body.data.every((h: { note?: unknown }) => !('note' in h))).toBe(true);
  });
});
