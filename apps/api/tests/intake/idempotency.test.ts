import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { createTestTenant } from '../helpers/tenant.js';
import { createTestApiKey } from '../helpers/api-key.js';
import { ensureWebsiteLeadSource, intakeRequest } from '../helpers/intake.js';
import { prisma } from '../../src/db/prisma.js';

describe('Website intake: idempotency', () => {
  it('replaying the same Idempotency-Key returns the original result shape (duplicate: true) and creates nothing new', async () => {
    const tenant = await createTestTenant();
    await ensureWebsiteLeadSource(tenant);
    const { key } = await createTestApiKey(tenant);
    const app = createApp();

    const firstRes = await intakeRequest(app, key, 'replay-1', {
      formType: 'contact',
      fields: { name: 'Once', email: 'once@example.com' },
    });
    expect(firstRes.status).toBe(201);
    const leadCountBefore = await prisma.lead.count({ where: { organizationId: tenant.organization.id } });

    const secondRes = await intakeRequest(app, key, 'replay-1', {
      formType: 'contact',
      fields: { name: 'Once', email: 'once@example.com' },
    });
    expect(secondRes.status).toBe(200);
    expect(secondRes.body.data.submissionId).toBe(firstRes.body.data.submissionId);
    expect(secondRes.body.data.leadId).toBe(firstRes.body.data.leadId);
    expect(secondRes.body.data.duplicate).toBe(true);

    const leadCountAfter = await prisma.lead.count({ where: { organizationId: tenant.organization.id } });
    expect(leadCountAfter).toBe(leadCountBefore);
  });

  it('REQUIRED (D71): the same Idempotency-Key sent twice, the second time with a different and invalid body, still returns the original result untouched', async () => {
    const tenant = await createTestTenant();
    await ensureWebsiteLeadSource(tenant);
    const { key } = await createTestApiKey(tenant);
    const app = createApp();

    const firstRes = await intakeRequest(app, key, 'replay-invalid-body', {
      formType: 'contact',
      fields: { name: 'Valid First', email: 'valid-first@example.com' },
    });
    expect(firstRes.status).toBe(201);

    // Deliberately invalid against websiteEnquiryIntakeSchema: no `fields`
    // at all. If idempotency did not win over body validation, this would
    // fail with 422, not replay the original 201.
    const secondRes = await intakeRequest(app, key, 'replay-invalid-body', { formType: 'contact' });
    expect(secondRes.status).toBe(200);
    expect(secondRes.body.data.submissionId).toBe(firstRes.body.data.submissionId);
    expect(secondRes.body.data.leadId).toBe(firstRes.body.data.leadId);
    expect(secondRes.body.data.duplicate).toBe(true);

    const leadCount = await prisma.lead.count({ where: { organizationId: tenant.organization.id } });
    expect(leadCount).toBe(1);
  });

  it('replaying a key whose original submission was REJECTED returns the same 422 with the same message, and still creates nothing', async () => {
    const tenant = await createTestTenant();
    await ensureWebsiteLeadSource(tenant);
    const { key } = await createTestApiKey(tenant);
    const app = createApp();

    const firstRes = await intakeRequest(app, key, 'replay-rejected', {
      formType: 'contact',
      fields: { name: 'No Contact Info' },
    });
    expect(firstRes.status).toBe(422);

    // A corrected, perfectly valid body on the replay — idempotency still wins.
    const secondRes = await intakeRequest(app, key, 'replay-rejected', {
      formType: 'contact',
      fields: { name: 'No Contact Info', email: 'now-has-email@example.com' },
    });
    expect(secondRes.status).toBe(422);
    expect(secondRes.body.error.message).toBe(firstRes.body.error.message);

    const leadCount = await prisma.lead.count({ where: { organizationId: tenant.organization.id } });
    expect(leadCount).toBe(0);
    const submissionCount = await prisma.websiteSubmission.count({
      where: { organizationId: tenant.organization.id, externalId: 'replay-rejected' },
    });
    expect(submissionCount).toBe(1);
  });
});
