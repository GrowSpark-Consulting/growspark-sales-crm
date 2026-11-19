import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createHash } from 'node:crypto';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';
import { createTestTenant } from '../helpers/tenant.js';
import { ALLOWED_ORIGIN } from '../helpers/http.js';
import { SESSION_COOKIE_NAME } from '../../src/lib/cookies.js';
import { env } from '../../src/env.js';

function loginRequest(app: ReturnType<typeof createApp>) {
  return request(app).post('/api/v1/auth/login').set('Origin', ALLOWED_ORIGIN);
}

function extractCookie(res: request.Response): string {
  const raw = res.headers['set-cookie'];
  const cookies = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const sessionCookie = cookies.find((c: string) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
  if (!sessionCookie) {
    throw new Error('No session cookie in response');
  }
  return sessionCookie;
}

describe('POST /api/v1/auth/login', () => {
  it('succeeds with the right credentials, sets a correctly-flagged cookie, and stores only the hash', async () => {
    const tenant = await createTestTenant();
    const app = createApp();

    const res = await loginRequest(app).send({
      email: tenant.adminUser.email,
      password: tenant.adminPassword,
    });

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(tenant.adminUser.email);
    expect(res.body.data.user.role).toBe('ADMIN');
    expect(res.body.data.organization.name).toBe(tenant.organization.name);
    expect(res.body.data.permissions).toContain('users:manage');

    const cookie = extractCookie(res);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toContain('Path=/');
    expect(cookie).not.toContain('Secure'); // NODE_ENV is "test" here, not "production"
    expect(cookie).toMatch(new RegExp(`Max-Age=${env.SESSION_TTL_DAYS * 24 * 60 * 60}\\b`));

    const token = cookie.split(';')[0]!.split('=')[1]!;
    const expectedHash = createHash('sha256').update(token).digest('hex');
    const session = await prisma.session.findUnique({ where: { tokenHash: expectedHash } });
    expect(session).not.toBeNull();
    expect(session?.userId).toBe(tenant.adminUser.id);

    // The raw token must never appear in the database.
    const allSessions = await prisma.session.findMany();
    for (const s of allSessions) {
      expect(s.tokenHash).not.toBe(token);
    }

    const refreshedUser = await prisma.user.findUniqueOrThrow({ where: { id: tenant.adminUser.id } });
    expect(refreshedUser.lastLoginAt).not.toBeNull();
  });

  it('sets Secure only when told the environment is production', async () => {
    const { buildSessionCookieHeaderFor } = await import('../../src/lib/cookies.js');
    expect(buildSessionCookieHeaderFor('token', true)).toContain('Secure');
    expect(buildSessionCookieHeaderFor('token', false)).not.toContain('Secure');
  });

  it('rejects a wrong password with a generic 401', async () => {
    const tenant = await createTestTenant();
    const app = createApp();

    const res = await loginRequest(app).send({ email: tenant.adminUser.email, password: 'wrong-password' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
    expect(res.body.error.message).toBe('Invalid email or password');
  });

  it('rejects an unknown email with the identical generic 401', async () => {
    const app = createApp();

    const res = await loginRequest(app).send({ email: 'nobody@example.test', password: 'whatever12' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
    expect(res.body.error.message).toBe('Invalid email or password');
  });

  it('rejects a deactivated user with the identical generic 401, even with the correct password', async () => {
    const tenant = await createTestTenant();
    await prisma.user.update({ where: { id: tenant.adminUser.id }, data: { isActive: false } });
    const app = createApp();

    const res = await loginRequest(app).send({
      email: tenant.adminUser.email,
      password: tenant.adminPassword,
    });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
    expect(res.body.error.message).toBe('Invalid email or password');
  });

  it('rejects an invalid email shape with 422', async () => {
    const app = createApp();
    const res = await loginRequest(app).send({ email: 'not-an-email', password: 'x' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });
});
