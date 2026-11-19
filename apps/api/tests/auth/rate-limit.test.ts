import { describe, expect, it } from 'vitest';
import request from 'supertest';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { createApp } from '../../src/app.js';
import { createTestTenant } from '../helpers/tenant.js';
import { ALLOWED_ORIGIN } from '../helpers/http.js';
import { createGlobalLoginFloodLimiter } from '../../src/lib/rate-limit.js';
import { requestId } from '../../src/middleware/request-id.js';
import { errorHandler } from '../../src/middleware/error-handler.js';

function loginAttempt(app: ReturnType<typeof createApp>, email: string, password: string) {
  return request(app).post('/api/v1/auth/login').set('Origin', ALLOWED_ORIGIN).send({ email, password });
}

describe('login rate limiting (per-email, failed attempts only)', () => {
  it('blocks the 11th FAILED attempt for the same email within the window with 429', async () => {
    const tenant = await createTestTenant();
    const app = createApp();

    for (let i = 0; i < 10; i++) {
      const res = await loginAttempt(app, tenant.adminUser.email, 'wrong-password-on-purpose');
      expect(res.status).toBe(401); // a failed attempt, not yet rate-limited
    }

    const eleventh = await loginAttempt(app, tenant.adminUser.email, 'wrong-password-on-purpose');
    expect(eleventh.status).toBe(429);
    expect(eleventh.body.error.code).toBe('RATE_LIMITED');
  });

  it('10 successful logins in a row never trigger the per-email limit', async () => {
    const tenant = await createTestTenant();
    const app = createApp();

    for (let i = 0; i < 10; i++) {
      const res = await loginAttempt(app, tenant.adminUser.email, tenant.adminPassword);
      expect(res.status).toBe(200);
    }

    // An 11th success, beyond the 10-failure threshold, must still succeed —
    // skipSuccessfulRequests means a correct login never counts at all.
    const eleventh = await loginAttempt(app, tenant.adminUser.email, tenant.adminPassword);
    expect(eleventh.status).toBe(200);
  });

  it('a different email is unaffected by another email having just been blocked', async () => {
    const tenant = await createTestTenant();
    const app = createApp();

    for (let i = 0; i < 10; i++) {
      const res = await loginAttempt(app, tenant.adminUser.email, 'wrong-password-on-purpose');
      expect(res.status).toBe(401);
    }
    const blocked = await loginAttempt(app, tenant.adminUser.email, 'wrong-password-on-purpose');
    expect(blocked.status).toBe(429);

    // A brand-new email, first attempt: must reach real auth logic (401 for
    // the wrong password), not be blocked by the other email's limiter.
    const freshEmail = `nobody-${randomUUID()}@example.test`;
    const unaffected = await loginAttempt(app, freshEmail, 'wrong-password-on-purpose');
    expect(unaffected.status).toBe(401);
  });
});

describe('login global flood ceiling', () => {
  // Exercised in isolation with a deliberately low ceiling, independent of
  // the full login flow: the ceiling mechanism itself is generic (a single
  // shared counter, keyed the same way regardless of request content), so
  // this proves it trips at exactly its configured threshold without
  // needing 50 real requests against the default production ceiling.
  function buildFloodTestApp(ceiling: number) {
    const { limiter } = createGlobalLoginFloodLimiter(ceiling);
    const app = express();
    app.use(requestId);
    app.use(express.json());
    // Always "fails" (4xx), so skipSuccessfulRequests never skips counting it.
    app.post('/simulate-login', limiter, (_req, res) => res.status(401).json({ simulated: 'failure' }));
    app.use(errorHandler);
    return app;
  }

  it('allows exactly `ceiling` failed requests, then blocks the next one with 429, regardless of which identity is used', async () => {
    const ceiling = 3;
    const app = buildFloodTestApp(ceiling);

    for (let i = 0; i < ceiling; i++) {
      const res = await request(app)
        .post('/simulate-login')
        .send({ email: `user-${i}@example.test` }); // a different "identity" each time — irrelevant to a global ceiling
      expect(res.status).toBe(401);
    }

    const overCeiling = await request(app).post('/simulate-login').send({ email: 'yet-another@example.test' });
    expect(overCeiling.status).toBe(429);
    expect(overCeiling.body.error.code).toBe('RATE_LIMITED');
  });

  it('does not count successful (2xx) requests towards the ceiling', async () => {
    const ceiling = 2;
    const { limiter } = createGlobalLoginFloodLimiter(ceiling);
    const app = express();
    app.use(requestId);
    app.use(express.json());
    app.post('/simulate-login', limiter, (_req, res) => res.status(200).json({ simulated: 'success' }));
    app.use(errorHandler);

    for (let i = 0; i < ceiling + 5; i++) {
      const res = await request(app).post('/simulate-login').send({});
      expect(res.status).toBe(200);
    }
  });
});
