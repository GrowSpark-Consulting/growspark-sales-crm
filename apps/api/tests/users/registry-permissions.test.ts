import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { getRegisteredRoutes } from '../../src/lib/route-registry.js';
import { createTestTenant } from '../helpers/tenant.js';
import { createSession } from '../../src/lib/session.js';
import { ALLOWED_ORIGIN, sessionCookieHeader } from '../helpers/http.js';

const PLACEHOLDER_ID = '00000000-0000-7000-8000-000000000000';

describe('users/audit routes: Staff permission enforcement', () => {
  it('returns 403 for Staff on every registered /api/v1/users* and /api/v1/audit-events route, except GET /api/v1/users/options', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.staffUser.id);
    const app = createApp();

    const routes = getRegisteredRoutes().filter(
      (route) =>
        (route.path.startsWith('/api/v1/users') && route.path !== '/api/v1/users/options') ||
        route.path === '/api/v1/audit-events',
    );
    // Sanity check the filter actually matched the 8 users:manage-gated
    // routes this package adds (options is excluded on purpose — see below) —
    // a typo in the filter would otherwise make this test vacuously pass.
    expect(routes.length).toBe(8);

    for (const route of routes) {
      const path = route.path.replace(':id', PLACEHOLDER_ID);
      let req = request(app)[route.method](path).set('Cookie', sessionCookieHeader(token));
      if (route.method !== 'get') {
        req = req.set('Origin', ALLOWED_ORIGIN).set('Content-Type', 'application/json').send({});
      }
      const res = await req;
      expect(res.status, `${route.method.toUpperCase()} ${route.path} should be 403 for Staff`).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    }
  });

  it('GET /api/v1/users/options is allowed for Staff (owner pickers need it, not just Admin)', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.staffUser.id);
    const app = createApp();

    const res = await request(app).get('/api/v1/users/options').set('Cookie', sessionCookieHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.data.some((u: { id: string }) => u.id === tenant.staffUser.id)).toBe(true);
  });
});
