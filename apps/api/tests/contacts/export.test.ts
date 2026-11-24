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

describe('GET /api/v1/contacts/export', () => {
  it('lets an Admin download a CSV with a header row, one row per contact, and the linked company name', async () => {
    const tenant = await createTestTenant();
    const company = await prisma.company.create({
      data: { organizationId: tenant.organization.id, name: 'Example Foods', nameNormalized: 'example foods' },
    });
    await prisma.contact.create({
      data: {
        organizationId: tenant.organization.id,
        companyId: company.id,
        firstName: 'Asha',
        lastName: 'Rao',
        email: 'asha.rao@example.com',
        emailNormalized: 'asha.rao@example.com',
      },
    });
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);

    const res = await authedGet(createApp(), token, '/api/v1/contacts/export');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('attachment; filename="contacts-export-');
    // See tests/leads/export.test.ts for why: Excel's SYLK misdetection
    // against a bare "ID" first cell, found in manual testing.
    expect(res.text.charCodeAt(0)).toBe(0xfeff);
    const afterBom = (res.text as string).slice(1);
    expect(afterBom.slice(0, 2)).not.toBe('ID');
    expect(afterBom.startsWith('Contact ID,')).toBe(true);
    const lines = (res.text as string).trim().split('\r\n');
    expect(lines[0]).toBe(
      'Contact ID,First name,Last name,Email,Phone,Job title,Department,Location,Lifecycle status,Company,Owner,Notes,Archived at,Created at,Updated at',
    );
    expect(lines.length).toBe(2);
    expect(lines[1]).toContain('Asha,Rao,asha.rao@example.com');
    expect(lines[1]).toContain('Example Foods');
  });

  it('lets a Staff user download the export too', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.staffUser.id);

    const res = await authedGet(createApp(), token, '/api/v1/contacts/export');

    expect(res.status).toBe(200);
  });

  it('refuses an unauthenticated request', async () => {
    const res = await request(createApp()).get('/api/v1/contacts/export');
    expect(res.status).toBe(401);
  });

  it('never includes a contact from another organisation', async () => {
    const [orgA, orgB] = await createTwoTestTenants();
    await prisma.contact.create({
      data: { organizationId: orgB.organization.id, firstName: 'OtherOrgContact', phone: '+911234567890' },
    });
    const { token } = await createSession(orgA.organization.id, orgA.adminUser.id);

    const res = await authedGet(createApp(), token, '/api/v1/contacts/export');

    expect(res.status).toBe(200);
    expect(res.text).not.toContain('OtherOrgContact');
  });
});
