import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { PERMISSIONS } from '@growspark/shared';
import { createApp } from '../../src/app.js';
import { getRegisteredRoutes, defineRoute } from '../../src/lib/route-registry.js';
import { auditRoutes } from '../helpers/route-audit.js';
import { createTestTenant } from '../helpers/tenant.js';
import { createSession } from '../../src/lib/session.js';

describe('route registry', () => {
  it('every real route in the running app matches a registry entry, and vice versa', () => {
    const app = createApp();
    const { unregistered, stale } = auditRoutes(app, getRegisteredRoutes());
    expect(unregistered).toEqual([]);
    expect(stale).toEqual([]);
  });

  it('PROOF this check can fail: a route added outside defineRoute is detected, and the proof clears once removed', () => {
    const bypassedApp = createApp();
    // The exact mistake this test exists to catch: a route wired directly
    // onto the app, skipping defineRoute (so it got no session/permission
    // middleware and no registry entry).
    bypassedApp.get('/sneaky-unprotected-route', (_req, res) => res.json({ ok: true }));

    const withBypass = auditRoutes(bypassedApp, getRegisteredRoutes());
    expect(withBypass.unregistered).toContainEqual({ method: 'get', path: '/sneaky-unprotected-route' });

    // A freshly built app (no bypass) passes again — proving the failure
    // above was caused by the bypass, not by a broken check.
    const cleanApp = createApp();
    const clean = auditRoutes(cleanApp, getRegisteredRoutes());
    expect(clean.unregistered).toEqual([]);
  });

  it('every registered route declares "public", "authenticated", or a real permission string', () => {
    createApp();
    const permissionValues: string[] = Object.values(PERMISSIONS);
    for (const route of getRegisteredRoutes()) {
      const isValid =
        route.auth === 'public' || route.auth === 'authenticated' || permissionValues.includes(route.auth);
      expect(isValid, `route ${route.method} ${route.path} has invalid auth: ${route.auth}`).toBe(true);
    }
  });

  it('the public routes are exactly the documented allow-list (plus the /api/v1 health/db mirror)', () => {
    createApp();
    const publicRoutes = getRegisteredRoutes()
      .filter((route) => route.auth === 'public')
      .map((route) => `${route.method.toUpperCase()} ${route.path}`)
      .sort();

    // The brief enumerates GET /health, GET /health/db, GET /api/v1/health,
    // and POST /api/v1/auth/login. GET /api/v1/health/db is also included:
    // health.ts has always mirrored both health routes under /api/v1 (see
    // PROJECT-STATE.md's repository map), and there is no reason the /db
    // variant should be the one exception — documented here rather than
    // silently narrowed to the brief's literal four-item list.
    expect(publicRoutes).toEqual(
      [
        'GET /health',
        'GET /health/db',
        'GET /api/v1/health',
        'GET /api/v1/health/db',
        'POST /api/v1/auth/login',
      ].sort(),
    );
  });

  it('requirePermission (enforced via the registry) returns 403 for Staff and 200 for Admin', async () => {
    const tenant = await createTestTenant();
    const app = createApp({
      extraRoutes: (testApp) => {
        defineRoute({
          app: testApp,
          method: 'get',
          path: '/__test-only/users-manage',
          auth: PERMISSIONS.USERS_MANAGE,
          handler: (_req, res) => res.status(200).json({ ok: true }),
        });
      },
    });

    const { token: staffToken } = await createSession(tenant.organization.id, tenant.staffUser.id);
    const { token: adminToken } = await createSession(tenant.organization.id, tenant.adminUser.id);

    const staffRes = await request(app)
      .get('/__test-only/users-manage')
      .set('Cookie', `crm_session=${staffToken}`);
    expect(staffRes.status).toBe(403);
    expect(staffRes.body.error.code).toBe('FORBIDDEN');

    const adminRes = await request(app)
      .get('/__test-only/users-manage')
      .set('Cookie', `crm_session=${adminToken}`);
    expect(adminRes.status).toBe(200);
  });

  it('a permission-gated route still requires a session at all (401 with no cookie)', async () => {
    const app = createApp({
      extraRoutes: (testApp) => {
        defineRoute({
          app: testApp,
          method: 'get',
          path: '/__test-only/users-manage-2',
          auth: PERMISSIONS.USERS_MANAGE,
          handler: (_req, res) => res.status(200).json({ ok: true }),
        });
      },
    });

    const res = await request(app).get('/__test-only/users-manage-2');
    expect(res.status).toBe(401);
  });
});
