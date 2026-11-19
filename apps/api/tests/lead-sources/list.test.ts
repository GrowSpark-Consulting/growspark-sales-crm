import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';
import { createTestTenant, createTwoTestTenants } from '../helpers/tenant.js';
import { createSession } from '../../src/lib/session.js';
import { sessionCookieHeader } from '../helpers/http.js';

describe('GET /api/v1/lead-sources', () => {
  it('returns only active sources, ordered by sortOrder then name, for both roles', async () => {
    const tenant = await createTestTenant();
    await prisma.leadSource.create({
      data: { organizationId: tenant.organization.id, name: 'Zzz Inactive', isActive: false, sortOrder: 0 },
    });
    await prisma.leadSource.create({
      data: { organizationId: tenant.organization.id, name: 'Referral', isActive: true, sortOrder: 2 },
    });
    const app = createApp();

    for (const user of [tenant.adminUser, tenant.staffUser]) {
      const { token } = await createSession(tenant.organization.id, user.id);
      const res = await request(app).get('/api/v1/lead-sources').set('Cookie', sessionCookieHeader(token));
      expect(res.status).toBe(200);
      const names = res.body.data.map((s: { name: string }) => s.name);
      expect(names).not.toContain('Zzz Inactive');
      // tenant.leadSource (seeded by createTestTenant) has sortOrder 1, so it comes before Referral (2).
      expect(names.indexOf(tenant.leadSource.name)).toBeLessThan(names.indexOf('Referral'));
    }
  });

  it('never includes another organisation\'s sources', async () => {
    const [orgA, orgB] = await createTwoTestTenants();
    const { token } = await createSession(orgA.organization.id, orgA.adminUser.id);
    const app = createApp();

    const res = await request(app).get('/api/v1/lead-sources').set('Cookie', sessionCookieHeader(token));
    expect(res.status).toBe(200);
    const ids = res.body.data.map((s: { id: string }) => s.id);
    expect(ids).not.toContain(orgB.leadSource.id);
  });

  it('requires a session (401)', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v1/lead-sources');
    expect(res.status).toBe(401);
  });
});
