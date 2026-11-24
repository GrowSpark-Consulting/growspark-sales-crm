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

describe('GET /api/v1/deals/export', () => {
  it('lets an Admin download a CSV with a header row, one row per deal, and the company/stage names', async () => {
    const tenant = await createTestTenant();
    const company = await prisma.company.create({
      data: { organizationId: tenant.organization.id, name: 'Example Foods', nameNormalized: 'example foods' },
    });
    await prisma.deal.create({
      data: {
        organizationId: tenant.organization.id,
        name: 'Example Foods — Automation Project',
        companyId: company.id,
        pipelineId: tenant.pipeline.id,
        stageId: tenant.stages[0]!.id,
        probability: tenant.stages[0]!.probability,
        value: 250000,
      },
    });
    const { token } = await createSession(tenant.organization.id, tenant.adminUser.id);

    const res = await authedGet(createApp(), token, '/api/v1/deals/export');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('attachment; filename="deals-export-');
    // See tests/leads/export.test.ts for why: Excel's SYLK misdetection
    // against a bare "ID" first cell, found in manual testing.
    expect(res.text.charCodeAt(0)).toBe(0xfeff);
    const afterBom = (res.text as string).slice(1);
    expect(afterBom.slice(0, 2)).not.toBe('ID');
    expect(afterBom.startsWith('Deal ID,')).toBe(true);
    const lines = (res.text as string).trim().split('\r\n');
    expect(lines[0]).toBe(
      'Deal ID,Name,Company,Stage,Value,Currency,Probability,Expected close date,Owner,Deal type,Source,Status,Closed at,Lost reason,Lost note,Archived at,Created at,Updated at',
    );
    expect(lines.length).toBe(2);
    expect(lines[1]).toContain('Example Foods — Automation Project');
    expect(lines[1]).toContain(tenant.stages[0]!.name);
  });

  it('lets a Staff user download the export too', async () => {
    const tenant = await createTestTenant();
    const { token } = await createSession(tenant.organization.id, tenant.staffUser.id);

    const res = await authedGet(createApp(), token, '/api/v1/deals/export');

    expect(res.status).toBe(200);
  });

  it('refuses an unauthenticated request', async () => {
    const res = await request(createApp()).get('/api/v1/deals/export');
    expect(res.status).toBe(401);
  });

  it('never includes a deal from another organisation', async () => {
    const [orgA, orgB] = await createTwoTestTenants();
    const otherCompany = await prisma.company.create({
      data: { organizationId: orgB.organization.id, name: 'OtherOrgCo', nameNormalized: 'otherorgco' },
    });
    await prisma.deal.create({
      data: {
        organizationId: orgB.organization.id,
        name: 'OtherOrgDeal',
        companyId: otherCompany.id,
        pipelineId: orgB.pipeline.id,
        stageId: orgB.stages[0]!.id,
        probability: orgB.stages[0]!.probability,
      },
    });
    const { token } = await createSession(orgA.organization.id, orgA.adminUser.id);

    const res = await authedGet(createApp(), token, '/api/v1/deals/export');

    expect(res.status).toBe(200);
    expect(res.text).not.toContain('OtherOrgDeal');
  });
});
