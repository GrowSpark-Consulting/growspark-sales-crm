import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { createTwoTestTenants } from '../helpers/tenant.js';
import { createSession } from '../../src/lib/session.js';
import { ALLOWED_ORIGIN, sessionCookieHeader } from '../helpers/http.js';

describe('organisation isolation', () => {
  it('a user in another organisation returns 404, not the record', async () => {
    const [orgA, orgB] = await createTwoTestTenants();
    const { token } = await createSession(orgA.organization.id, orgA.adminUser.id);
    const app = createApp();

    const res = await request(app)
      .get(`/api/v1/users/${orgB.adminUser.id}`)
      .set('Cookie', sessionCookieHeader(token));
    expect(res.status).toBe(404);
  });

  it("GET /api/v1/users/options for one organisation never includes another organisation's users", async () => {
    const [orgA, orgB] = await createTwoTestTenants();
    const { token } = await createSession(orgA.organization.id, orgA.adminUser.id);
    const app = createApp();

    const res = await request(app)
      .get('/api/v1/users/options')
      .set('Cookie', sessionCookieHeader(token));
    expect(res.status).toBe(200);
    const ids = res.body.data.map((u: { id: string }) => u.id);
    expect(ids).not.toContain(orgB.adminUser.id);
    expect(ids).not.toContain(orgB.staffUser.id);
  });

  it("the users list for one organisation never includes another organisation's users", async () => {
    const [orgA, orgB] = await createTwoTestTenants();
    const { token } = await createSession(orgA.organization.id, orgA.adminUser.id);
    const app = createApp();

    const res = await request(app).get('/api/v1/users').set('Cookie', sessionCookieHeader(token));
    expect(res.status).toBe(200);
    const ids = res.body.data.map((u: { id: string }) => u.id);
    expect(ids).not.toContain(orgB.adminUser.id);
    expect(ids).not.toContain(orgB.staffUser.id);
  });

  it('cannot update a user in another organisation (404)', async () => {
    const [orgA, orgB] = await createTwoTestTenants();
    const { token } = await createSession(orgA.organization.id, orgA.adminUser.id);
    const app = createApp();

    const res = await request(app)
      .patch(`/api/v1/users/${orgB.staffUser.id}`)
      .set('Origin', ALLOWED_ORIGIN)
      .set('Cookie', sessionCookieHeader(token))
      .send({ name: 'Hijacked' });
    expect(res.status).toBe(404);
  });

  it('cannot deactivate a user in another organisation (404)', async () => {
    const [orgA, orgB] = await createTwoTestTenants();
    const { token } = await createSession(orgA.organization.id, orgA.adminUser.id);
    const app = createApp();

    const res = await request(app)
      .post(`/api/v1/users/${orgB.staffUser.id}/deactivate`)
      .set('Origin', ALLOWED_ORIGIN)
      .set('Cookie', sessionCookieHeader(token));
    expect(res.status).toBe(404);
  });

  it('audit events from another organisation are invisible', async () => {
    const [orgA, orgB] = await createTwoTestTenants();
    const { token: tokenB } = await createSession(orgB.organization.id, orgB.adminUser.id);
    const app = createApp();

    await request(app)
      .patch(`/api/v1/users/${orgB.staffUser.id}`)
      .set('Origin', ALLOWED_ORIGIN)
      .set('Cookie', sessionCookieHeader(tokenB))
      .send({ name: 'Changed In B' });

    const { token: tokenA } = await createSession(orgA.organization.id, orgA.adminUser.id);
    const res = await request(app).get('/api/v1/audit-events').set('Cookie', sessionCookieHeader(tokenA));
    expect(res.status).toBe(200);
    const entityIds = res.body.data.map((e: { entityId: string | null }) => e.entityId);
    expect(entityIds).not.toContain(orgB.staffUser.id);
  });

  it("a single audit event's actorId filter never matches another organisation's actor", async () => {
    const [orgA, orgB] = await createTwoTestTenants();
    const { token: tokenA } = await createSession(orgA.organization.id, orgA.adminUser.id);
    const app = createApp();

    const res = await request(app)
      .get(`/api/v1/audit-events?actorId=${orgB.adminUser.id}`)
      .set('Cookie', sessionCookieHeader(tokenA));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});
