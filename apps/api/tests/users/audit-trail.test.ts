import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';
import { createTestTenant } from '../helpers/tenant.js';
import { createSession } from '../../src/lib/session.js';
import { ALLOWED_ORIGIN, sessionCookieHeader } from '../helpers/http.js';

describe('audit trail for user management actions', () => {
  it('writes one audit row per action, with the correct actor, entity, and no secrets in metadata', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();
    const cookie = sessionCookieHeader(token);

    const createRes = await request(app)
      .post('/api/v1/users')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Cookie', cookie)
      .send({
        email: `audit-target-${Date.now()}@example.test`,
        name: 'Audit Target',
        role: 'STAFF',
        password: 'a-valid-password-1',
      });
    expect(createRes.status).toBe(201);
    const userId = createRes.body.data.id as string;

    await request(app)
      .patch(`/api/v1/users/${userId}`)
      .set('Origin', ALLOWED_ORIGIN)
      .set('Cookie', cookie)
      .send({ name: 'Renamed' });

    await request(app)
      .patch(`/api/v1/users/${userId}`)
      .set('Origin', ALLOWED_ORIGIN)
      .set('Cookie', cookie)
      .send({ role: 'ADMIN' }); // promotion — never blocked by last-Admin

    await request(app)
      .post(`/api/v1/users/${userId}/deactivate`)
      .set('Origin', ALLOWED_ORIGIN)
      .set('Cookie', cookie);

    await request(app)
      .post(`/api/v1/users/${userId}/reactivate`)
      .set('Origin', ALLOWED_ORIGIN)
      .set('Cookie', cookie);

    await request(app)
      .post(`/api/v1/users/${userId}/reset-password`)
      .set('Origin', ALLOWED_ORIGIN)
      .set('Cookie', cookie)
      .send({ newPassword: 'another-valid-password-2' });

    const expectedActions = [
      'user.created',
      'user.updated',
      'user.role_changed',
      'user.deactivated',
      'user.reactivated',
      'user.password_reset',
    ];

    for (const action of expectedActions) {
      const event = await prisma.auditEvent.findFirst({
        where: { organizationId: tenant.organization.id, entityId: userId, action },
      });
      expect(event, `expected an audit row for ${action}`).not.toBeNull();
      expect(event?.entityType).toBe('user');
      expect(event?.actorId).toBe(tenant.adminUser.id);

      const metadataText = JSON.stringify(event?.metadata ?? {}).toLowerCase();
      expect(metadataText).not.toMatch(/password|passwordhash|\bhash\b|\$argon2/);
    }
  });
});
