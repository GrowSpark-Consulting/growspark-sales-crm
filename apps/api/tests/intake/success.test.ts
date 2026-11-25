import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { createTestTenant } from '../helpers/tenant.js';
import { createTestApiKey } from '../helpers/api-key.js';
import { ensureWebsiteLeadSource, intakeRequest } from '../helpers/intake.js';
import { prisma } from '../../src/db/prisma.js';

describe('Website intake: successful submissions', () => {
  it('maps a "contact" form submission (the roadmap\'s own sample payload), creates a Lead sourced Website, and stores the submission as LEAD_CREATED', async () => {
    const tenant = await createTestTenant();
    await ensureWebsiteLeadSource(tenant);
    const { key } = await createTestApiKey(tenant);
    const app = createApp();

    const res = await intakeRequest(app, key, 'ext-1', {
      formType: 'contact',
      submittedAt: '2026-11-18T09:12:44Z',
      sourcePage: 'https://www.growsparkconsulting.com/contact/',
      fields: {
        name: 'Asha Rao',
        email: 'asha@example.com',
        company: 'Example Foods Pvt Ltd',
        team_size: '51-200',
        challenge: 'Manual order tracking is slowing our plants.',
        website: 'https://example.com',
        revenue: '2cr-10cr',
        context: '',
      },
    });

    expect(res.status).toBe(201);
    expect(res.body.data.leadId).not.toBeNull();
    expect(res.body.data.duplicate).toBe(false);
    expect(res.body.data.possibleDuplicateLeadIds).toEqual([]);

    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: res.body.data.leadId as string } });
    expect(lead.firstName).toBe('Asha');
    expect(lead.lastName).toBe('Rao');
    expect(lead.email).toBe('asha@example.com');
    expect(lead.companyName).toBe('Example Foods Pvt Ltd');
    expect(lead.website).toBe('https://example.com');
    expect(lead.requirement).toBe('Manual order tracking is slowing our plants.');
    expect(lead.sourceDetail).toBe('Website / Contact Form');
    expect(lead.capturedFields).toEqual({ team_size: '51-200', revenue: '2cr-10cr', context: '' });

    const submission = await prisma.websiteSubmission.findUniqueOrThrow({
      where: { id: res.body.data.submissionId as string },
    });
    expect(submission.status).toBe('LEAD_CREATED');
    expect(submission.leadId).toBe(lead.id);
    expect(submission.externalId).toBe('ext-1');
    expect(submission.sourcePage).toBe('https://www.growsparkconsulting.com/contact/');
  });

  it('accepts a submission with only a phone, no email', async () => {
    const tenant = await createTestTenant();
    await ensureWebsiteLeadSource(tenant);
    const { key } = await createTestApiKey(tenant);
    const app = createApp();

    const res = await intakeRequest(app, key, 'ext-phone-only', {
      formType: 'strategy_session',
      fields: { name: 'Phone Only', phone: '+919876543210' },
    });
    expect(res.status).toBe(201);
  });

  it.each([
    ['contact', 'Website / Contact Form'],
    ['engagement_application', 'Website / Engagement Application'],
    ['strategy_session', 'Website / Strategy Session'],
    ['growth_intensive', 'Website / Growth Intensive'],
    ['something_unrecognised', 'Website / something_unrecognised'],
  ])('maps formType "%s" to sourceDetail "%s"', async (formType, expectedSourceDetail) => {
    const tenant = await createTestTenant();
    await ensureWebsiteLeadSource(tenant);
    const { key } = await createTestApiKey(tenant);
    const app = createApp();

    const res = await intakeRequest(app, key, `ext-${formType}`, {
      formType,
      fields: { name: 'Someone', email: `${formType}@example.com` },
    });
    expect(res.status).toBe(201);
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: res.body.data.leadId as string } });
    expect(lead.sourceDetail).toBe(expectedSourceDetail);
  });

  it('warns about a duplicate email among existing Leads via possibleDuplicateLeadIds, but still creates the new Lead', async () => {
    const tenant = await createTestTenant();
    await ensureWebsiteLeadSource(tenant);
    const { key } = await createTestApiKey(tenant);
    const app = createApp();

    const firstRes = await intakeRequest(app, key, 'ext-dup-1', {
      formType: 'contact',
      fields: { name: 'First Person', email: 'dup@example.com' },
    });
    const existingLeadId = firstRes.body.data.leadId as string;

    const secondRes = await intakeRequest(app, key, 'ext-dup-2', {
      formType: 'contact',
      fields: { name: 'Second Person', email: 'Dup@Example.com' },
    });
    expect(secondRes.status).toBe(201);
    expect(secondRes.body.data.possibleDuplicateLeadIds).toEqual([existingLeadId]);
    expect(secondRes.body.data.leadId).not.toBe(existingLeadId);
  });

  it('a phone-based duplicate is also surfaced', async () => {
    const tenant = await createTestTenant();
    await ensureWebsiteLeadSource(tenant);
    const { key } = await createTestApiKey(tenant);
    const app = createApp();

    const firstRes = await intakeRequest(app, key, 'ext-phone-dup-1', {
      formType: 'contact',
      fields: { name: 'First', phone: '+919876543210' },
    });
    const existingLeadId = firstRes.body.data.leadId as string;

    const secondRes = await intakeRequest(app, key, 'ext-phone-dup-2', {
      formType: 'contact',
      fields: { name: 'Second', phone: '+91 98765 43210' },
    });
    expect(secondRes.body.data.possibleDuplicateLeadIds).toEqual([existingLeadId]);
  });

  it('D98: a website enquiry with no company still creates a lead — intake is exempt from the company rule', async () => {
    const tenant = await createTestTenant();
    await ensureWebsiteLeadSource(tenant);
    const { key } = await createTestApiKey(tenant);
    const res = await intakeRequest(createApp(), key, 'ext-no-company', {
      formType: 'contact',
      submittedAt: '2026-11-25T09:00:00Z',
      fields: { name: 'Ravi Kumar', email: 'ravi@example.com', challenge: 'Needs help.' },
    });
    expect(res.status).toBe(201);
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: res.body.data.leadId as string } });
    expect(lead.companyName).toBeNull();
  });
});
