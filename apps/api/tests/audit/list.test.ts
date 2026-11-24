import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { createTestTenant } from '../helpers/tenant.js';
import { createSession } from '../../src/lib/session.js';
import { prisma } from '../../src/db/prisma.js';
import { ALLOWED_ORIGIN, sessionCookieHeader } from '../helpers/http.js';

describe('GET /api/v1/audit-events', () => {
  it('refuses a Staff user (Admin-only, audit:read)', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.staffUser.id);

    const res = await request(createApp()).get('/api/v1/audit-events').set('Cookie', sessionCookieHeader(token));

    expect(res.status).toBe(403);
  });

  it('refuses an unauthenticated request', async () => {
    const res = await request(createApp()).get('/api/v1/audit-events');
    expect(res.status).toBe(401);
  });

  it('never exposes a sensitive metadata field, however it got into the row', async () => {
    // A real writeAudit() call site would never write these keys (verified
    // by reading every call site — see docs/decisions.md) — this proves the
    // response-layer allowlist (sanitizeAuditMetadata) holds even if a
    // future call site, or a bug, ever did.
    const tenant = await createTestTenant();
    await prisma.auditEvent.create({
      data: {
        organizationId: tenant.organization.id,
        actorId: tenant.adminUser.id,
        action: 'test.poisoned_event',
        entityType: 'test',
        entityId: null,
        metadata: {
          name: 'a safe field',
          rawKey: 'gsk_live_shouldneverappear',
          password: 'shouldneverappear',
          passwordHash: '$argon2id$shouldneverappear',
          token: 'shouldneverappear',
          sessionToken: 'shouldneverappear',
          secret: 'shouldneverappear',
        },
      },
    });
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);

    const res = await request(createApp())
      .get('/api/v1/audit-events?action=test.poisoned_event')
      .set('Cookie', sessionCookieHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].metadata).toEqual({ name: 'a safe field' });
    const raw = JSON.stringify(res.body);
    for (const forbidden of ['gsk_live_shouldneverappear', 'shouldneverappear', 'rawKey', 'password', 'secret']) {
      expect(raw).not.toContain(forbidden);
    }
  });

  it('returns newest first, and supports action/entityType/actorId filters', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();
    const cookie = sessionCookieHeader(token);

    const createRes = await request(app)
      .post('/api/v1/users')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Cookie', cookie)
      .send({
        email: `audit-list-${Date.now()}@example.test`,
        name: 'Audit Lister',
        role: 'STAFF',
        password: 'a-valid-password-1',
      });
    const userId = createRes.body.data.id as string;

    await request(app)
      .patch(`/api/v1/users/${userId}`)
      .set('Origin', ALLOWED_ORIGIN)
      .set('Cookie', cookie)
      .send({ name: 'Renamed Lister' });

    const res = await request(app).get('/api/v1/audit-events').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);

    const createdAts = res.body.data.map((e: { createdAt: string }) => new Date(e.createdAt).getTime());
    expect(createdAts).toEqual([...createdAts].sort((a, b) => b - a));

    const byAction = await request(app)
      .get('/api/v1/audit-events?action=user.created')
      .set('Cookie', cookie);
    expect(byAction.status).toBe(200);
    expect(byAction.body.data.length).toBeGreaterThan(0);
    expect(byAction.body.data.every((e: { action: string }) => e.action === 'user.created')).toBe(true);

    const byEntityType = await request(app)
      .get('/api/v1/audit-events?entityType=user')
      .set('Cookie', cookie);
    expect(byEntityType.status).toBe(200);
    expect(byEntityType.body.data.every((e: { entityType: string }) => e.entityType === 'user')).toBe(true);

    const byActor = await request(app)
      .get(`/api/v1/audit-events?actorId=${tenant.adminUser.id}`)
      .set('Cookie', cookie);
    expect(byActor.status).toBe(200);
    expect(byActor.body.data.every((e: { actorId: string }) => e.actorId === tenant.adminUser.id)).toBe(
      true,
    );
  });

  it('filters by a date range (from/to)', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();
    const cookie = sessionCookieHeader(token);

    await request(app)
      .post('/api/v1/users')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Cookie', cookie)
      .send({
        email: `audit-range-${Date.now()}@example.test`,
        name: 'Range Target',
        role: 'STAFF',
        password: 'a-valid-password-1',
      });

    const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const inRange = await request(app)
      .get(`/api/v1/audit-events?from=${past}&to=${future}`)
      .set('Cookie', cookie);
    expect(inRange.status).toBe(200);
    expect(inRange.body.data.length).toBeGreaterThan(0);

    const outOfRange = await request(app)
      .get(`/api/v1/audit-events?from=${future}`)
      .set('Cookie', cookie);
    expect(outOfRange.status).toBe(200);
    expect(outOfRange.body.data).toEqual([]);
  });

  it('rejects an invalid actorId (not a UUID) with 422', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();

    const res = await request(app)
      .get('/api/v1/audit-events?actorId=not-a-uuid')
      .set('Cookie', sessionCookieHeader(token));
    expect(res.status).toBe(422);
  });
});
