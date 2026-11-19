import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';
import { createTestTenant } from '../helpers/tenant.js';
import { createSession } from '../../src/lib/session.js';
import { ALLOWED_ORIGIN, sessionCookieHeader } from '../helpers/http.js';
import { verifyPassword } from '../../src/lib/password.js';

function authed(app: ReturnType<typeof createApp>, token: string) {
  const cookie = sessionCookieHeader(token);
  return {
    get: (path: string) => request(app).get(path).set('Cookie', cookie),
    post: (path: string, body?: object) =>
      request(app).post(path).set('Origin', ALLOWED_ORIGIN).set('Cookie', cookie).send(body ?? {}),
    patch: (path: string, body?: object) =>
      request(app).patch(path).set('Origin', ALLOWED_ORIGIN).set('Cookie', cookie).send(body ?? {}),
  };
}

describe('Admin user management CRUD', () => {
  it('creates, reads, lists, updates, deactivates, reactivates, and resets the password of a user', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();
    const api = authed(app, token);

    const createRes = await api.post('/api/v1/users', {
      email: 'New.Hire@Example.test',
      name: 'New Hire',
      role: 'STAFF',
      password: 'a-valid-password-1',
    });
    expect(createRes.status).toBe(201);
    expect(createRes.body.data.email).toBe('new.hire@example.test');
    expect(createRes.body.data).not.toHaveProperty('passwordHash');
    const userId = createRes.body.data.id as string;

    const getRes = await api.get(`/api/v1/users/${userId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.name).toBe('New Hire');

    const listRes = await api.get('/api/v1/users');
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.some((u: { id: string }) => u.id === userId)).toBe(true);
    expect(listRes.body.meta.total).toBe(3); // seeded admin + staff + this new hire

    const patchRes = await api.patch(`/api/v1/users/${userId}`, { name: 'Renamed Hire' });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.name).toBe('Renamed Hire');

    const deactivateRes = await api.post(`/api/v1/users/${userId}/deactivate`);
    expect(deactivateRes.status).toBe(200);
    expect(deactivateRes.body.data.isActive).toBe(false);

    const reactivateRes = await api.post(`/api/v1/users/${userId}/reactivate`);
    expect(reactivateRes.status).toBe(200);
    expect(reactivateRes.body.data.isActive).toBe(true);

    const resetRes = await api.post(`/api/v1/users/${userId}/reset-password`, {
      newPassword: 'a-new-password-99',
    });
    expect(resetRes.status).toBe(204);

    const stored = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(await verifyPassword(stored.passwordHash, 'a-new-password-99')).toBe(true);
  });

  it('rejects creating a second user with the same email in the same organisation (409)', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();
    const api = authed(app, token);

    const res = await api.post('/api/v1/users', {
      email: tenant.adminUser.email,
      name: 'Duplicate',
      role: 'STAFF',
      password: 'a-valid-password-1',
    });
    expect(res.status).toBe(409);
  });

  it('rejects a create body with a password shorter than 10 characters (422)', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();
    const api = authed(app, token);

    const res = await api.post('/api/v1/users', {
      email: 'short@example.test',
      name: 'Short',
      role: 'STAFF',
      password: 'short',
    });
    expect(res.status).toBe(422);
  });

  it('rejects an update body with neither name nor role (422)', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();
    const api = authed(app, token);

    const res = await api.patch(`/api/v1/users/${tenant.staffUser.id}`, {});
    expect(res.status).toBe(422);
  });

  it('GET /api/v1/users/:id returns 404 for an id that does not exist', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();
    const api = authed(app, token);

    const res = await api.get('/api/v1/users/00000000-0000-7000-8000-000000000000');
    expect(res.status).toBe(404);
  });
});
