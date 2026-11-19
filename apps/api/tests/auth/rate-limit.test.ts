import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../../src/app.js';
import { createTestTenant } from '../helpers/tenant.js';
import { ALLOWED_ORIGIN } from '../helpers/http.js';

function attempt(app: ReturnType<typeof createApp>, email: string, forwardedFor?: string) {
  const req = request(app)
    .post('/api/v1/auth/login')
    .set('Origin', ALLOWED_ORIGIN)
    .send({ email, password: 'wrong-password-on-purpose' });
  return forwardedFor ? req.set('X-Forwarded-For', forwardedFor) : req;
}

describe('login rate limiting', () => {
  it('blocks the 11th attempt for the same email within the window with 429', async () => {
    const tenant = await createTestTenant();
    const app = createApp();

    for (let i = 0; i < 10; i++) {
      const res = await attempt(app, tenant.adminUser.email);
      expect(res.status).toBe(401); // wrong password, but not yet rate-limited
    }

    const eleventh = await attempt(app, tenant.adminUser.email);
    expect(eleventh.status).toBe(429);
    expect(eleventh.body.error.code).toBe('RATE_LIMITED');
  });

  it('the per-IP limiter blocks the 11th attempt from one IP even across different emails', async () => {
    const app = createApp();

    for (let i = 0; i < 10; i++) {
      const res = await attempt(app, `nobody-${randomUUID()}@example.test`);
      expect(res.status).toBe(401); // unknown email, but not yet rate-limited
    }

    const eleventh = await attempt(app, `nobody-${randomUUID()}@example.test`);
    expect(eleventh.status).toBe(429);
  });

  it('a different IP is unaffected by another IP exhausting its own limit', async () => {
    // trustProxy lets X-Forwarded-For simulate two distinct client IPs —
    // verified empirically that Express 5 honours it this way (see
    // docs/decisions.md). Without this, every supertest request shares one
    // loopback address and the two IPs could never be told apart.
    const app = createApp({ trustProxy: 1 });
    const emailOnIpA = `ip-a-${randomUUID()}@example.test`;

    for (let i = 0; i < 10; i++) {
      const res = await attempt(app, emailOnIpA, '10.0.0.1');
      expect(res.status).toBe(401);
    }
    const eleventhOnIpA = await attempt(app, emailOnIpA, '10.0.0.1');
    expect(eleventhOnIpA.status).toBe(429);

    // A fresh IP, fresh email, first attempt: must reach the real auth logic
    // (401 for the wrong password), not be blocked by IP A's limiter.
    const firstOnIpB = await attempt(app, `ip-b-${randomUUID()}@example.test`, '10.0.0.2');
    expect(firstOnIpB.status).toBe(401);
  });

  // Not separately tested: "a different email, same IP that just got
  // blocked, is unaffected." With both limits set to the same threshold (10)
  // and one IP hammering one email, the per-IP counter for that IP reaches
  // 10 in lockstep with the per-email counter — so by the 11th request *any*
  // email from that IP is correctly blocked by the per-IP limiter too. The
  // "different email is unaffected" guarantee only holds, and is only
  // meaningfully testable, across different IPs — which the test above
  // covers.
});
