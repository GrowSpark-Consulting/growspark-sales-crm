import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { createTestTenant, createTwoTestTenants } from '../helpers/tenant.js';
import { createSession } from '../../src/lib/session.js';
import { prisma } from '../../src/db/prisma.js';
import { sessionCookieHeader } from '../helpers/http.js';

function authedGet(app: ReturnType<typeof createApp>, token: string, path: string) {
  return request(app).get(path).set('Cookie', sessionCookieHeader(token));
}

describe('GET /api/v1/companies/export', () => {
  it('lets an Admin download a CSV with a header row and one row per company', async () => {
    const tenant = await createTestTenant();
    await prisma.company.create({
      data: {
        organizationId: tenant.organization.id,
        name: 'Example Foods Pvt Ltd',
        nameNormalized: 'example foods pvt ltd',
        city: 'Hyderabad',
      },
    });
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);

    const res = await authedGet(createApp(), token, '/api/v1/companies/export');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('attachment; filename="companies-export-');
    // See tests/leads/export.test.ts for why: Excel's SYLK misdetection
    // against a bare "ID" first cell, found in manual testing.
    expect(res.text.charCodeAt(0)).toBe(0xfeff);
    const afterBom = (res.text as string).slice(1);
    expect(afterBom.slice(0, 2)).not.toBe('ID');
    expect(afterBom.startsWith('Company ID,')).toBe(true);
    const lines = (res.text as string).trim().split('\r\n');
    expect(lines[0]).toBe(
      'Company ID,Name,Legal name,Industry,Website,Email,Phone,Employee size,Annual revenue,Address line 1,Address line 2,City,State,Postal code,Country,Owner,Description,Archived at,Created at,Updated at',
    );
    expect(lines.length).toBe(2);
    expect(lines[1]).toContain('Example Foods Pvt Ltd');
    expect(lines[1]).toContain('Hyderabad');
  });

  it('lets a Staff user download the export too', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.staffUser.id);

    const res = await authedGet(createApp(), token, '/api/v1/companies/export');

    expect(res.status).toBe(200);
  });

  it('refuses an unauthenticated request', async () => {
    const res = await request(createApp()).get('/api/v1/companies/export');
    expect(res.status).toBe(401);
  });

  it('quotes a company name that contains a comma', async () => {
    const tenant = await createTestTenant();
    await prisma.company.create({
      data: {
        organizationId: tenant.organization.id,
        name: 'Example Foods, Pvt Ltd',
        nameNormalized: 'example foods pvt ltd 2',
      },
    });
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);

    const res = await authedGet(createApp(), token, '/api/v1/companies/export');

    expect(res.status).toBe(200);
    expect(res.text).toContain('"Example Foods, Pvt Ltd"');
  });

  it('never includes a company from another organisation', async () => {
    const [orgA, orgB] = await createTwoTestTenants();
    await prisma.company.create({
      data: { organizationId: orgB.organization.id, name: 'OtherOrgCo', nameNormalized: 'otherorgco' },
    });
    const { token } = await createSession(orgA.organization.id, orgA.adminUser.id);

    const res = await authedGet(createApp(), token, '/api/v1/companies/export');

    expect(res.status).toBe(200);
    expect(res.text).not.toContain('OtherOrgCo');
  });
});
