import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { createTestTenant } from '../helpers/tenant.js';
import { createTestApiKey } from '../helpers/api-key.js';
import { ensureWebsiteLeadSource, intakeRequest } from '../helpers/intake.js';
import { prisma } from '../../src/db/prisma.js';
import { ALLOWED_ORIGIN } from '../helpers/http.js';

describe('Website intake: validation and rejection', () => {
  it('a missing Idempotency-Key header returns 422, before anything is stored', async () => {
    const tenant = await createTestTenant();
    const { key } = await createTestApiKey(tenant);
    const app = createApp();

    const res = await request(app)
      .post('/api/v1/intake/website-enquiries')
      .set('Authorization', `Bearer ${key}`)
      .set('Origin', ALLOWED_ORIGIN)
      .set('Content-Type', 'application/json')
      .send({ formType: 'contact', fields: { name: 'X', email: 'x@example.com' } });
    expect(res.status).toBe(422);

    const count = await prisma.websiteSubmission.count({ where: { organizationId: tenant.organization.id } });
    expect(count).toBe(0);
  });

  it('a blank Idempotency-Key header is treated the same as missing (422)', async () => {
    const tenant = await createTestTenant();
    const { key } = await createTestApiKey(tenant);
    const app = createApp();

    const res = await request(app)
      .post('/api/v1/intake/website-enquiries')
      .set('Authorization', `Bearer ${key}`)
      .set('Idempotency-Key', '   ')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Content-Type', 'application/json')
      .send({ formType: 'contact', fields: { name: 'X', email: 'x@example.com' } });
    expect(res.status).toBe(422);
  });

  it('a genuine mapping failure (no email or phone after mapping) stores the submission as REJECTED with the error, and responds 422', async () => {
    const tenant = await createTestTenant();
    await ensureWebsiteLeadSource(tenant);
    const { key } = await createTestApiKey(tenant);
    const app = createApp();

    const res = await intakeRequest(app, key, 'no-contact-info', {
      formType: 'contact',
      fields: { name: 'No Contact', company: 'Acme' },
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');

    const submission = await prisma.websiteSubmission.findFirstOrThrow({
      where: { organizationId: tenant.organization.id, externalId: 'no-contact-info' },
    });
    expect(submission.status).toBe('REJECTED');
    expect(submission.error).toBeTruthy();
    expect(submission.leadId).toBeNull();
  });

  it('an envelope that fails the schema entirely is stored as REJECTED too — nothing is lost silently', async () => {
    const tenant = await createTestTenant();
    const { key } = await createTestApiKey(tenant);
    const app = createApp();

    const res = await intakeRequest(app, key, 'malformed-envelope', { nonsense: true });
    expect(res.status).toBe(422);

    const submission = await prisma.websiteSubmission.findFirstOrThrow({
      where: { organizationId: tenant.organization.id, externalId: 'malformed-envelope' },
    });
    expect(submission.status).toBe('REJECTED');
    expect(submission.payload).toEqual({ nonsense: true });
  });

  it('an oversized body is rejected 413 by the existing global body-size limit, before the intake handler ever runs', async () => {
    const tenant = await createTestTenant();
    const { key } = await createTestApiKey(tenant);
    const app = createApp();

    const bigValue = 'x'.repeat(200 * 1024);
    const res = await intakeRequest(app, key, 'too-big', {
      formType: 'contact',
      fields: { name: 'Big', email: 'big@example.com', blob: bigValue },
    });
    expect(res.status).toBe(413);
  });
});
