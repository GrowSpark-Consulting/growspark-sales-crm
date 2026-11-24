import { describe, expect, it } from 'vitest';
import request from 'supertest';
import express from 'express';
import { ROLES } from '@growspark/shared';
import { createApp } from '../../src/app.js';
import { createTestTenant } from '../helpers/tenant.js';
import { createTestApiKey } from '../helpers/api-key.js';
import { ensureWebsiteLeadSource, intakeRequest } from '../helpers/intake.js';
import { createSession } from '../../src/lib/session.js';
import * as apiKeysService from '../../src/modules/api-keys/api-keys.service.js';
import { INTAKE_KEY_MAX_REQUESTS_PER_MINUTE, createIntakeIpRateLimiter } from '../../src/lib/rate-limit.js';
import { requestId } from '../../src/middleware/request-id.js';
import { errorHandler } from '../../src/middleware/error-handler.js';
import { ALLOWED_ORIGIN, sessionCookieHeader } from '../helpers/http.js';
import type { RequestContext } from '../../src/lib/context.js';

describe('Website intake: authentication and the Origin exemption (D71)', () => {
  it('rejects a request with no API key at all (401)', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/v1/intake/website-enquiries')
      .set('Idempotency-Key', 'no-key')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Content-Type', 'application/json')
      .send({ formType: 'contact', fields: {} });
    expect(res.status).toBe(401);
  });

  it('rejects a revoked key (401)', async () => {
    const tenant = await createTestTenant();
    const { key, apiKeyId } = await createTestApiKey(tenant);
    const ctx: RequestContext = { userId: tenant.adminUser.id, orgId: tenant.organization.id, role: ROLES.ADMIN };
    await apiKeysService.revokeApiKey(ctx, apiKeyId);
    const app = createApp();

    const res = await intakeRequest(app, key, 'revoked-key', { formType: 'contact', fields: {} });
    expect(res.status).toBe(401);
  });

  it('a session cookie with no Authorization header is rejected with 401, never reaching the Origin check (no Origin header is sent here either — a 403 would mean it got past attachApiKeyContext)', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();

    const res = await request(app)
      .post('/api/v1/intake/website-enquiries')
      .set('Cookie', sessionCookieHeader(token))
      .set('Idempotency-Key', 'cookie-no-key')
      .set('Content-Type', 'application/json')
      .send({ formType: 'contact', fields: {} });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('a valid key with no Origin header at all still succeeds — the Origin check is exempted once a key is verified', async () => {
    const tenant = await createTestTenant();
    await ensureWebsiteLeadSource(tenant);
    const { key } = await createTestApiKey(tenant);
    const app = createApp();

    const res = await request(app)
      .post('/api/v1/intake/website-enquiries')
      .set('Authorization', `Bearer ${key}`)
      .set('Idempotency-Key', 'no-origin')
      .set('Content-Type', 'application/json')
      .send({ formType: 'contact', fields: { name: 'No Origin', email: 'no-origin@example.com' } });
    expect(res.status).toBe(201);
  });

  it('a valid key with the wrong Content-Type is still rejected 415 — the exemption never covers Content-Type', async () => {
    const tenant = await createTestTenant();
    const { key } = await createTestApiKey(tenant);
    const app = createApp();

    const res = await request(app)
      .post('/api/v1/intake/website-enquiries')
      .set('Authorization', `Bearer ${key}`)
      .set('Idempotency-Key', 'wrong-content-type')
      .set('Content-Type', 'text/plain')
      .send('not json');
    expect(res.status).toBe(415);
  });

  it(
    `enforces the per-key rate limit: request number ${INTAKE_KEY_MAX_REQUESTS_PER_MINUTE + 1} within a minute gets 429`,
    async () => {
      const tenant = await createTestTenant();
      const { key } = await createTestApiKey(tenant);
      const app = createApp();

      // No Idempotency-Key header -> fails fast with 422 inside the handler,
      // never touching the database — but the rate limiter runs as
      // middleware before the handler, so every one of these still counts
      // against the per-key budget.
      const send = () =>
        request(app)
          .post('/api/v1/intake/website-enquiries')
          .set('Authorization', `Bearer ${key}`)
          .set('Origin', ALLOWED_ORIGIN)
          .set('Content-Type', 'application/json')
          .send({ formType: 'contact', fields: {} });

      for (let i = 0; i < INTAKE_KEY_MAX_REQUESTS_PER_MINUTE; i += 1) {
        const res = await send();
        expect(res.status).toBe(422);
      }
      const limited = await send();
      expect(limited.status).toBe(429);
      expect(limited.body.error.code).toBe('RATE_LIMITED');
    },
    20000,
  );
});

describe('intake per-IP rate limiting (isolated, low-ceiling)', () => {
  // Isolated from the real intake route and its real 120/min ceiling, same
  // reasoning as tests/auth/rate-limit.test.ts's "login global flood
  // ceiling": express-rate-limit's counting/keying mechanism is generic, so
  // this proves the per-IP limiter mechanism itself trips at a configured
  // threshold without needing 120+ real requests against production's
  // ceiling.
  //
  // What this test DOES prove: createIntakeIpRateLimiter correctly counts
  // requests keyed by req.ip and rejects with 429 once the ceiling is
  // exceeded.
  //
  // What it does NOT, and cannot, prove from here: that req.ip is a
  // genuine, distinct value per real-world caller once this runs on Render.
  // TRUST_PROXY stays false (D60, not changed by this work), and nothing in
  // this local test process can simulate Render's actual edge/load-balancer
  // network path. In production this limiter is honestly expected to
  // collapse into one shared counter across every caller, not a real
  // per-caller one — see docs/decisions.md D71/D72's "per-IP rate limiting"
  // bullets. This test is evidence the code works as written, not evidence
  // of what it achieves once deployed.
  function buildIpLimiterTestApp(ceiling: number) {
    const { limiter } = createIntakeIpRateLimiter(ceiling);
    const app = express();
    app.use(requestId);
    app.use(express.json());
    app.post('/simulate-intake', limiter, (_req, res) => res.status(201).json({ simulated: 'success' }));
    app.use(errorHandler);
    return app;
  }

  it('allows exactly `ceiling` requests from the same simulated IP, then blocks the next one with 429', async () => {
    const ceiling = 3;
    const app = buildIpLimiterTestApp(ceiling);

    for (let i = 0; i < ceiling; i++) {
      const res = await request(app).post('/simulate-intake').send({});
      expect(res.status).toBe(201);
    }

    const overCeiling = await request(app).post('/simulate-intake').send({});
    expect(overCeiling.status).toBe(429);
    expect(overCeiling.body.error.code).toBe('RATE_LIMITED');
  });
});
