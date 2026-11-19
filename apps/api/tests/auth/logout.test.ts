import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';
import { createTestTenant } from '../helpers/tenant.js';
import { ALLOWED_ORIGIN } from '../helpers/http.js';
import { createSession } from '../../src/lib/session.js';
import { logout } from '../../src/modules/auth/auth.service.js';

describe('POST /api/v1/auth/logout', () => {
  it('requires authentication', async () => {
    const app = createApp();
    const res = await request(app).post('/api/v1/auth/logout').set('Origin', ALLOWED_ORIGIN);
    expect(res.status).toBe(401);
  });

  it('deletes the session row and clears the cookie, so the old cookie fails on the next request', async () => {
    const tenant = await createTestTenant();
    const { token, session } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();

    const logoutRes = await request(app)
      .post('/api/v1/auth/logout')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Cookie', `crm_session=${token}`);

    expect(logoutRes.status).toBe(204);
    const setCookie = logoutRes.headers['set-cookie'];
    const cleared = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    expect(cleared).toContain('crm_session=;');
    expect(cleared).toMatch(/Max-Age=0\b/);

    const row = await prisma.session.findUnique({ where: { id: session.id } });
    expect(row).toBeNull();

    const meRes = await request(app).get('/api/v1/auth/me').set('Cookie', `crm_session=${token}`);
    expect(meRes.status).toBe(401);
  });

  it('the service logout is idempotent: logging out a token twice does not throw', async () => {
    // Guards against a request racing the session's own expiry/deletion
    // between the auth middleware's check and the handler's delete — not
    // reachable through the HTTP route (an already-gone session 401s at the
    // auth gate before the handler runs), so exercised at the service level.
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);

    await expect(logout(token)).resolves.toBeUndefined();
    await expect(logout(token)).resolves.toBeUndefined();
  });
});
