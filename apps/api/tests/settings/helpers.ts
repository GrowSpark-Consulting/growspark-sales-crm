import request from 'supertest';
import { createApp } from '../../src/app.js';
import { createSession } from '../../src/lib/session.js';
import { ALLOWED_ORIGIN, sessionCookieHeader } from '../helpers/http.js';
import type { TestTenant } from '../helpers/tenant.js';

export type App = ReturnType<typeof createApp>;

export function authed(app: App, token: string) {
  const cookie = sessionCookieHeader(token);
  return {
    get: (path: string) => request(app).get(path).set('Cookie', cookie),
    post: (path: string, body?: object) =>
      request(app).post(path).set('Origin', ALLOWED_ORIGIN).set('Cookie', cookie).send(body ?? {}),
    patch: (path: string, body?: object) =>
      request(app).patch(path).set('Origin', ALLOWED_ORIGIN).set('Cookie', cookie).send(body ?? {}),
    put: (path: string, body?: object) =>
      request(app).put(path).set('Origin', ALLOWED_ORIGIN).set('Cookie', cookie).send(body ?? {}),
    delete: (path: string) => request(app).delete(path).set('Origin', ALLOWED_ORIGIN).set('Cookie', cookie),
  };
}

export async function adminApi(tenant: TestTenant, app: App = createApp()) {
  const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
  return authed(app, token);
}

export async function staffApi(tenant: TestTenant, app: App = createApp()) {
  const { token } = await createSession(tenant.organization.id, tenant.staffUser.id);
  return authed(app, token);
}
