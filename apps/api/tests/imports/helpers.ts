import request from 'supertest';
import { createApp } from '../../src/app.js';
import { createSession } from '../../src/lib/session.js';
import { ALLOWED_ORIGIN, sessionCookieHeader } from '../helpers/http.js';
import type { TestTenant } from '../helpers/tenant.js';

export type App = ReturnType<typeof createApp>;

export async function importApi(app: App, tenant: TestTenant, role: 'admin' | 'staff' = 'staff') {
  const user = role === 'admin' ? tenant.adminUser : tenant.staffUser;
  const { token } = await createSession(tenant.organization.id, user.id);
  const cookie = sessionCookieHeader(token);
  const post = (path: string, body: object) =>
    request(app).post(path).set('Origin', ALLOWED_ORIGIN).set('Cookie', cookie).send(body);
  return {
    preview: (entity: 'leads' | 'contacts', csv: string, mapping?: (string | null)[]) =>
      post(`/api/v1/imports/${entity}/preview`, mapping ? { csv, mapping } : { csv }),
    commit: (entity: 'leads' | 'contacts', csv: string, mapping: (string | null)[]) =>
      post(`/api/v1/imports/${entity}/commit`, { csv, mapping }),
    template: (entity: 'leads' | 'contacts') => request(app).get(`/api/v1/imports/${entity}/template`).set('Cookie', cookie),
    post,
  };
}

/** Joins rows with CRLF, quoting nothing — callers write any quoting themselves. */
export function csvLines(...lines: string[]): string {
  return lines.join('\r\n') + '\r\n';
}
