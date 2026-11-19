import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { createTestTenant } from '../helpers/tenant.js';
import { createSession } from '../../src/lib/session.js';
import { ALLOWED_ORIGIN, sessionCookieHeader } from '../helpers/http.js';

describe('deactivation effects', () => {
  it("deletes the deactivated user's sessions, so their old session cookie is refused on the next request", async () => {
    const tenant = await createTestTenant();
    const { token: staffToken } = await createSession(tenant.organization.id, tenant.staffUser.id);
    const { token: adminToken } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();

    const deactivateRes = await request(app)
      .post(`/api/v1/users/${tenant.staffUser.id}/deactivate`)
      .set('Origin', ALLOWED_ORIGIN)
      .set('Cookie', sessionCookieHeader(adminToken));
    expect(deactivateRes.status).toBe(200);

    const meRes = await request(app).get('/api/v1/auth/me').set('Cookie', sessionCookieHeader(staffToken));
    expect(meRes.status).toBe(401);
  });

  it('a reset password also deletes the target user\'s sessions', async () => {
    const tenant = await createTestTenant();
    const { token: staffToken } = await createSession(tenant.organization.id, tenant.staffUser.id);
    const { token: adminToken } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();

    const resetRes = await request(app)
      .post(`/api/v1/users/${tenant.staffUser.id}/reset-password`)
      .set('Origin', ALLOWED_ORIGIN)
      .set('Cookie', sessionCookieHeader(adminToken))
      .send({ newPassword: 'a-forced-new-password-1' });
    expect(resetRes.status).toBe(204);

    const meRes = await request(app).get('/api/v1/auth/me').set('Cookie', sessionCookieHeader(staffToken));
    expect(meRes.status).toBe(401);
  });
});
