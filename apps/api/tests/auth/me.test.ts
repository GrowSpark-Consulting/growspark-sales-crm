import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';
import { createTestTenant } from '../helpers/tenant.js';
import { createSession, hashSessionToken } from '../../src/lib/session.js';

describe('GET /api/v1/auth/me', () => {
  it('returns 401 with no cookie at all', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('returns the correct user, organization and permissions for a valid session', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.staffUser.id);
    const app = createApp();

    const res = await request(app).get('/api/v1/auth/me').set('Cookie', `crm_session=${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBe(tenant.staffUser.id);
    expect(res.body.data.user.role).toBe('STAFF');
    expect(res.body.data.organization.name).toBe(tenant.organization.name);
    expect(res.body.data.permissions).not.toContain('users:manage');
    expect(res.body.data.permissions).toContain('leads:write');
  });

  it('returns 401 for an expired session', async () => {
    const tenant = await createTestTenant();
    const { token, session } = await createSession(tenant.organization.id, tenant.adminUser.id);
    await prisma.session.update({ where: { id: session.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const app = createApp();

    const res = await request(app).get('/api/v1/auth/me').set('Cookie', `crm_session=${token}`);
    expect(res.status).toBe(401);
  });

  it('returns 401 for a deleted session', async () => {
    const tenant = await createTestTenant();
    const { token, session } = await createSession(tenant.organization.id, tenant.adminUser.id);
    await prisma.session.delete({ where: { id: session.id } });
    const app = createApp();

    const res = await request(app).get('/api/v1/auth/me').set('Cookie', `crm_session=${token}`);
    expect(res.status).toBe(401);
  });

  it('returns 401 for a session whose user was deactivated after the session was created', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    // Deactivated directly, bypassing any deactivate endpoint — the session
    // row itself is untouched, so only the middleware's isActive check can catch this.
    await prisma.user.update({ where: { id: tenant.adminUser.id }, data: { isActive: false } });
    const app = createApp();

    const res = await request(app).get('/api/v1/auth/me').set('Cookie', `crm_session=${token}`);
    expect(res.status).toBe(401);
  });

  it('rejects a garbage cookie value (no matching session hash) with 401', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v1/auth/me').set('Cookie', 'crm_session=not-a-real-token');
    expect(res.status).toBe(401);
  });

  it('extends session expiry on activity but throttles the write to once per interval', async () => {
    const tenant = await createTestTenant();
    const { token, session } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const originalExpiresAt = session.expiresAt.getTime();
    const originalLastSeenAt = session.lastSeenAt.getTime();

    // Back-date lastSeenAt beyond the 10-minute throttle window so the touch actually writes.
    await prisma.session.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date(originalLastSeenAt - 11 * 60 * 1000) },
    });

    const app = createApp();
    const res = await request(app).get('/api/v1/auth/me').set('Cookie', `crm_session=${token}`);
    expect(res.status).toBe(200);

    const refreshed = await prisma.session.findUniqueOrThrow({ where: { id: session.id } });
    expect(refreshed.expiresAt.getTime()).toBeGreaterThan(originalExpiresAt);
  });

  it('does not write a sliding-expiry update within the throttle window', async () => {
    const tenant = await createTestTenant();
    const { token, session } = await createSession(tenant.organization.id, tenant.adminUser.id);

    const app = createApp();
    const res = await request(app).get('/api/v1/auth/me').set('Cookie', `crm_session=${token}`);
    expect(res.status).toBe(200);

    const refreshed = await prisma.session.findUniqueOrThrow({ where: { id: session.id } });
    // lastSeenAt was just set by createSession a moment ago — well within the
    // 10-minute throttle — so the middleware's touch should be a no-op.
    expect(refreshed.updatedAt.getTime()).toBe(session.updatedAt.getTime());
  });

  it('confirms the session hash, not the raw token, is what is stored', async () => {
    const tenant = await createTestTenant();
    const { token, session } = await createSession(tenant.organization.id, tenant.adminUser.id);
    expect(session.tokenHash).toBe(hashSessionToken(token));
    expect(session.tokenHash).not.toBe(token);
  });
});
