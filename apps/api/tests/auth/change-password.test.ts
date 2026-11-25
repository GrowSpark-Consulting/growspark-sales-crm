import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';
import { createTestTenant } from '../helpers/tenant.js';
import { ALLOWED_ORIGIN } from '../helpers/http.js';
import { createSession } from '../../src/lib/session.js';
import { verifyPassword } from '../../src/lib/password.js';

function changePasswordRequest(app: ReturnType<typeof createApp>, token: string) {
  return request(app)
    .post('/api/v1/auth/change-password')
    .set('Origin', ALLOWED_ORIGIN)
    .set('Cookie', `crm_session=${token}`);
}

describe('POST /api/v1/auth/change-password', () => {
  it('requires authentication', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Origin', ALLOWED_ORIGIN)
      .send({ currentPassword: 'x', newPassword: 'newpassword1' });
    expect(res.status).toBe(401);
  });

  // 422 + a field error, never 401 — the web app signs the user out on any 401 (D93).
  it('refuses a wrong current password with a 422 field error and leaves the password and sessions untouched', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();

    const res = await changePasswordRequest(app, token).send({
      currentPassword: 'definitely-wrong',
      newPassword: 'brand-new-password-1',
    });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(res.body.error.details).toEqual([{ path: 'currentPassword', message: 'Current password is incorrect' }]);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: tenant.adminUser.id } });
    expect(await verifyPassword(user.passwordHash, tenant.adminPassword)).toBe(true);

    // The session used to make this very request must still work afterwards.
    const meRes = await request(app).get('/api/v1/auth/me').set('Cookie', `crm_session=${token}`);
    expect(meRes.status).toBe(200);
  });

  it('rejects a new password shorter than 10 characters with 422', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();

    const res = await changePasswordRequest(app, token).send({
      currentPassword: tenant.adminPassword,
      newPassword: 'short',
    });
    expect(res.status).toBe(422);
  });

  it('on success: updates the hash, invalidates every old session, writes an audit row, and sets a fresh cookie', async () => {
    const tenant = await createTestTenant();
    const { token: tokenA } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const { token: tokenB } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();
    const newPassword = 'a-brand-new-password-1';

    const res = await changePasswordRequest(app, tokenA).send({
      currentPassword: tenant.adminPassword,
      newPassword,
    });

    expect(res.status).toBe(204);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: tenant.adminUser.id } });
    expect(await verifyPassword(user.passwordHash, newPassword)).toBe(true);
    expect(await verifyPassword(user.passwordHash, tenant.adminPassword)).toBe(false);

    // Both the session used for this request AND the other, unrelated session are gone.
    const remainingSessions = await prisma.session.count({ where: { userId: tenant.adminUser.id } });
    expect(remainingSessions).toBe(1); // exactly the fresh one created by this change

    const oldSessionAUsable = await request(app).get('/api/v1/auth/me').set('Cookie', `crm_session=${tokenA}`);
    expect(oldSessionAUsable.status).toBe(401);
    const oldSessionBUsable = await request(app).get('/api/v1/auth/me').set('Cookie', `crm_session=${tokenB}`);
    expect(oldSessionBUsable.status).toBe(401);

    const setCookie = res.headers['set-cookie'];
    const newCookie = Array.isArray(setCookie) ? setCookie[0]! : setCookie!;
    const newToken = newCookie.split(';')[0]!.split('=')[1]!;
    const newSessionUsable = await request(app).get('/api/v1/auth/me').set('Cookie', `crm_session=${newToken}`);
    expect(newSessionUsable.status).toBe(200);

    const audit = await prisma.auditEvent.findFirst({
      where: { organizationId: tenant.organization.id, action: 'user.password_changed' },
    });
    expect(audit).not.toBeNull();
    expect(audit?.actorId).toBe(tenant.adminUser.id);
    expect(audit?.entityId).toBe(tenant.adminUser.id);
    expect(JSON.stringify(audit?.metadata ?? '')).not.toMatch(/password/i);
  });
});
