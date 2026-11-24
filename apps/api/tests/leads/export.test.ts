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

describe('GET /api/v1/leads/export', () => {
  it('lets an Admin download a CSV with a header row and one row per lead', async () => {
    const tenant = await createTestTenant();
    await prisma.lead.create({
      data: {
        organizationId: tenant.organization.id,
        firstName: 'Asha',
        lastName: 'Rao',
        email: 'asha.rao@example.com',
        emailNormalized: 'asha.rao@example.com',
        sourceId: tenant.leadSource.id,
        status: 'NEW',
      },
    });
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);

    const res = await authedGet(createApp(), token, '/api/v1/leads/export');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('attachment; filename="leads-export-');
    // Excel on Windows misdetects a CSV as an old SYLK file, and refuses to
    // open it, if the file's raw first two characters are the bare letters
    // "ID" — found in manual testing. A UTF-8 BOM must lead the file (so
    // Excel also reads non-ASCII characters correctly), and the real first
    // header must never be the bare text "ID".
    expect(res.text.charCodeAt(0)).toBe(0xfeff);
    const afterBom = (res.text as string).slice(1);
    expect(afterBom.slice(0, 2)).not.toBe('ID');
    expect(afterBom.startsWith('Lead ID,')).toBe(true);
    const lines = (res.text as string).trim().split('\r\n');
    expect(lines[0]).toBe(
      'Lead ID,First name,Last name,Email,Phone,Company name,Website,Job title,Industry,Source,Source detail,Status,Priority,Owner,Requirement,Estimated budget,Purchase timeline,Next follow-up,Notes,Converted at,Archived at,Created at,Updated at',
    );
    expect(lines.length).toBe(2);
    expect(lines[1]).toContain('Asha,Rao,asha.rao@example.com');
    expect(lines[1]).toContain(tenant.leadSource.name);
  });

  it('lets a Staff user download the export too (reports:export is not Admin-only)', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.staffUser.id);

    const res = await authedGet(createApp(), token, '/api/v1/leads/export');

    expect(res.status).toBe(200);
  });

  it('refuses an unauthenticated request', async () => {
    const res = await request(createApp()).get('/api/v1/leads/export');
    expect(res.status).toBe(401);
  });

  it('applies the same filters the list endpoint uses', async () => {
    const tenant = await createTestTenant();
    await prisma.lead.createMany({
      data: [
        {
          organizationId: tenant.organization.id,
          firstName: 'New Lead',
          email: 'new@example.com',
          emailNormalized: 'new@example.com',
          sourceId: tenant.leadSource.id,
          status: 'NEW',
        },
        {
          organizationId: tenant.organization.id,
          firstName: 'Qualified Lead',
          email: 'qualified@example.com',
          emailNormalized: 'qualified@example.com',
          sourceId: tenant.leadSource.id,
          status: 'QUALIFIED',
        },
      ],
    });
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);

    const res = await authedGet(createApp(), token, '/api/v1/leads/export?status=QUALIFIED');

    expect(res.status).toBe(200);
    expect(res.text).toContain('Qualified Lead');
    expect(res.text).not.toContain('New Lead');
  });

  it('neutralizes a formula-injection attempt in a real field, end to end', async () => {
    const tenant = await createTestTenant();
    await prisma.lead.create({
      data: {
        organizationId: tenant.organization.id,
        firstName: 'Normal',
        companyName: '=HYPERLINK("http://evil.test","click")',
        email: 'injection@example.com',
        emailNormalized: 'injection@example.com',
        sourceId: tenant.leadSource.id,
      },
    });
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);

    const res = await authedGet(createApp(), token, '/api/v1/leads/export');

    expect(res.status).toBe(200);
    expect(res.text).toContain('\'=HYPERLINK');
    expect(res.text).not.toMatch(/,=HYPERLINK/);
  });

  it('never includes a lead from another organisation', async () => {
    const [orgA, orgB] = await createTwoTestTenants();
    await prisma.lead.create({
      data: {
        organizationId: orgB.organization.id,
        firstName: 'OtherOrgLead',
        email: 'otherorg@example.com',
        emailNormalized: 'otherorg@example.com',
        sourceId: orgB.leadSource.id,
      },
    });
    const { token } = await createSession(orgA.organization.id, orgA.adminUser.id);

    const res = await authedGet(createApp(), token, '/api/v1/leads/export');

    expect(res.status).toBe(200);
    expect(res.text).not.toContain('OtherOrgLead');
  });
});
