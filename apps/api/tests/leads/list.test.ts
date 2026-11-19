import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';
import { createTestTenant } from '../helpers/tenant.js';
import { createSession } from '../../src/lib/session.js';
import { sessionCookieHeader } from '../helpers/http.js';

describe('GET /api/v1/leads — list, pagination, sort, filters', () => {
  it('paginates correctly', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();

    for (let i = 0; i < 3; i++) {
      await prisma.lead.create({
        data: {
          organizationId: tenant.organization.id,
          firstName: `Lead${i}`,
          sourceId: tenant.leadSource.id,
          email: `lead${i}@example.com`,
          emailNormalized: `lead${i}@example.com`,
        },
      });
    }

    const res = await request(app)
      .get('/api/v1/leads?page=1&pageSize=2')
      .set('Cookie', sessionCookieHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
    expect(res.body.meta).toEqual({ page: 1, pageSize: 2, total: 3 });
  });

  it('rejects an unknown sort field with 422', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();

    const res = await request(app).get('/api/v1/leads?sort=bogus:asc').set('Cookie', sessionCookieHeader(token));
    expect(res.status).toBe(422);
  });

  it('filters by status, source, owner, and priority', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();

    const matching = await prisma.lead.create({
      data: {
        organizationId: tenant.organization.id,
        firstName: 'Matching',
        sourceId: tenant.leadSource.id,
        ownerId: tenant.staffUser.id,
        priority: 'HIGH',
        status: 'QUALIFIED',
        email: 'matching@example.com',
        emailNormalized: 'matching@example.com',
      },
    });
    await prisma.lead.create({
      data: {
        organizationId: tenant.organization.id,
        firstName: 'NonMatching',
        sourceId: tenant.leadSource.id,
        priority: 'LOW',
        status: 'NEW',
        email: 'nonmatching@example.com',
        emailNormalized: 'nonmatching@example.com',
      },
    });

    const res = await request(app)
      .get(
        `/api/v1/leads?status=QUALIFIED&sourceId=${tenant.leadSource.id}&ownerId=${tenant.staffUser.id}&priority=HIGH`,
      )
      .set('Cookie', sessionCookieHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.data.map((l: { id: string }) => l.id)).toEqual([matching.id]);
  });

  it('filters by a created date range', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();

    const old = await prisma.lead.create({
      data: {
        organizationId: tenant.organization.id,
        firstName: 'Old',
        sourceId: tenant.leadSource.id,
        email: 'old@example.com',
        emailNormalized: 'old@example.com',
        createdAt: new Date('2020-01-01T00:00:00Z'),
      },
    });
    const recent = await prisma.lead.create({
      data: {
        organizationId: tenant.organization.id,
        firstName: 'Recent',
        sourceId: tenant.leadSource.id,
        email: 'recent@example.com',
        emailNormalized: 'recent@example.com',
      },
    });

    const res = await request(app)
      .get('/api/v1/leads?createdFrom=2026-01-01T00:00:00Z')
      .set('Cookie', sessionCookieHeader(token));
    expect(res.status).toBe(200);
    const ids = res.body.data.map((l: { id: string }) => l.id);
    expect(ids).toContain(recent.id);
    expect(ids).not.toContain(old.id);
  });

  it('searches by name/email/phone/company via q', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);
    const app = createApp();

    const created = await prisma.lead.create({
      data: {
        organizationId: tenant.organization.id,
        firstName: 'Findable',
        sourceId: tenant.leadSource.id,
        email: 'findable@example.com',
        emailNormalized: 'findable@example.com',
      },
    });

    const res = await request(app).get('/api/v1/leads?q=findable').set('Cookie', sessionCookieHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.data.some((l: { id: string }) => l.id === created.id)).toBe(true);
  });

  it('Staff can read the leads list', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.staffUser.id);
    const app = createApp();

    const res = await request(app).get('/api/v1/leads').set('Cookie', sessionCookieHeader(token));
    expect(res.status).toBe(200);
  });

  it('requires a session (401)', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v1/leads');
    expect(res.status).toBe(401);
  });
});
