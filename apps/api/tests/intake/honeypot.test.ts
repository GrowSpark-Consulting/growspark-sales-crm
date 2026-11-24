import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { createTestTenant } from '../helpers/tenant.js';
import { createTestApiKey } from '../helpers/api-key.js';
import { ensureWebsiteLeadSource, intakeRequest } from '../helpers/intake.js';
import { prisma } from '../../src/db/prisma.js';

describe('Website intake: honeypot', () => {
  it('a non-empty hp value stores the submission as SPAM, creates no Lead, and responds exactly like a real success (never tells the sender it was caught)', async () => {
    const tenant = await createTestTenant();
    await ensureWebsiteLeadSource(tenant);
    const { key } = await createTestApiKey(tenant);
    const app = createApp();

    const res = await intakeRequest(app, key, 'honeypot-1', {
      formType: 'contact',
      fields: { name: 'Bot', email: 'bot@example.com' },
      hp: 'i am a bot',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.leadId).toBeNull();
    expect(res.body.data.duplicate).toBe(false);
    // Byte-for-byte the same envelope shape as a real success — same keys, nothing extra.
    expect(Object.keys(res.body.data).sort()).toEqual(
      ['duplicate', 'leadId', 'possibleDuplicateLeadIds', 'submissionId'].sort(),
    );

    const submission = await prisma.websiteSubmission.findUniqueOrThrow({
      where: { id: res.body.data.submissionId as string },
    });
    expect(submission.status).toBe('SPAM');
    expect(submission.leadId).toBeNull();

    const leadCount = await prisma.lead.count({ where: { organizationId: tenant.organization.id } });
    expect(leadCount).toBe(0);
  });

  it('a blank/whitespace-only hp value is not treated as a honeypot hit', async () => {
    const tenant = await createTestTenant();
    await ensureWebsiteLeadSource(tenant);
    const { key } = await createTestApiKey(tenant);
    const app = createApp();

    const res = await intakeRequest(app, key, 'honeypot-blank', {
      formType: 'contact',
      fields: { name: 'Real Person', email: 'real@example.com' },
      hp: '   ',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.leadId).not.toBeNull();

    const submission = await prisma.websiteSubmission.findUniqueOrThrow({
      where: { id: res.body.data.submissionId as string },
    });
    expect(submission.status).toBe('LEAD_CREATED');
  });

  it('an absent hp field (the common real-visitor case) is not treated as a honeypot hit', async () => {
    const tenant = await createTestTenant();
    await ensureWebsiteLeadSource(tenant);
    const { key } = await createTestApiKey(tenant);
    const app = createApp();

    const res = await intakeRequest(app, key, 'honeypot-absent', {
      formType: 'contact',
      fields: { name: 'Real Person', email: 'real2@example.com' },
    });
    expect(res.status).toBe(201);
    expect(res.body.data.leadId).not.toBeNull();
  });
});
