import { describe, expect, it } from 'vitest';
import { createTestTenant } from '../helpers/tenant.js';
import { createTestApiKey } from '../helpers/api-key.js';
import { ensureWebsiteLeadSource, intakeRequest } from '../helpers/intake.js';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';

const SECRET_NAME = 'Audit Secret Person';
const SECRET_EMAIL = 'audit-secret@example.com';
const SECRET_PHONE = '+919876543210';
const SECRET_MESSAGE = 'A confidential business problem nobody else should see.';

async function auditRowsFor(organizationId: string, submissionId: string) {
  return prisma.auditEvent.findMany({ where: { organizationId, entityId: submissionId } });
}

/** Every secret/personal value this test checks never leaks into an audit row, across all three outcomes. */
function assertNoSecretsOrPersonalData(row: unknown, rawKey: string, idempotencyKey: string) {
  const serialized = JSON.stringify(row);
  expect(serialized).not.toContain(rawKey);
  expect(serialized).not.toContain(idempotencyKey);
  expect(serialized).not.toContain(SECRET_NAME);
  expect(serialized).not.toContain(SECRET_EMAIL);
  expect(serialized).not.toContain(SECRET_PHONE);
  expect(serialized).not.toContain(SECRET_MESSAGE);
}

describe('Intake audit rows: minimal metadata, no secrets or personal data (D71)', () => {
  it('a successful intake writes exactly one audit row — actorId null, metadata limited to submissionId/apiKeyPrefix, nothing else', async () => {
    const tenant = await createTestTenant();
    await ensureWebsiteLeadSource(tenant);
    const { key, keyPrefix } = await createTestApiKey(tenant);
    const app = createApp();
    const idempotencyKey = 'audit-success';

    const res = await intakeRequest(app, key, idempotencyKey, {
      formType: 'contact',
      fields: { name: SECRET_NAME, email: SECRET_EMAIL, phone: SECRET_PHONE, challenge: SECRET_MESSAGE },
    });
    expect(res.status).toBe(201);
    const submissionId = res.body.data.submissionId as string;

    const rows = await auditRowsFor(tenant.organization.id, submissionId);
    expect(rows.length).toBe(1);
    const row = rows[0]!;
    expect(row.actorId).toBeNull();
    expect(row.action).toBe('intake.lead_created');
    expect(row.metadata).toEqual({ submissionId, apiKeyPrefix: keyPrefix });
    assertNoSecretsOrPersonalData(row, key, idempotencyKey);
  });

  it('a honeypot (spam) intake writes exactly one audit row with the same minimal shape', async () => {
    const tenant = await createTestTenant();
    await ensureWebsiteLeadSource(tenant);
    const { key, keyPrefix } = await createTestApiKey(tenant);
    const app = createApp();
    const idempotencyKey = 'audit-spam';

    const res = await intakeRequest(app, key, idempotencyKey, {
      formType: 'contact',
      fields: { name: SECRET_NAME, email: SECRET_EMAIL, phone: SECRET_PHONE, challenge: SECRET_MESSAGE },
      hp: 'this is the bot',
    });
    expect(res.status).toBe(201);
    const submissionId = res.body.data.submissionId as string;

    const rows = await auditRowsFor(tenant.organization.id, submissionId);
    expect(rows.length).toBe(1);
    const row = rows[0]!;
    expect(row.actorId).toBeNull();
    expect(row.action).toBe('intake.spam');
    expect(row.metadata).toEqual({ submissionId, apiKeyPrefix: keyPrefix });
    assertNoSecretsOrPersonalData(row, key, idempotencyKey);
  });

  it('a rejected intake (no usable email or phone) writes exactly one audit row with the same minimal shape', async () => {
    const tenant = await createTestTenant();
    await ensureWebsiteLeadSource(tenant);
    const { key, keyPrefix } = await createTestApiKey(tenant);
    const app = createApp();
    const idempotencyKey = 'audit-rejected';

    const res = await intakeRequest(app, key, idempotencyKey, {
      formType: 'contact',
      fields: { name: SECRET_NAME, challenge: SECRET_MESSAGE },
    });
    expect(res.status).toBe(422);

    const submission = await prisma.websiteSubmission.findFirstOrThrow({
      where: { organizationId: tenant.organization.id, externalId: idempotencyKey },
    });
    expect(submission.status).toBe('REJECTED');

    const rows = await auditRowsFor(tenant.organization.id, submission.id);
    expect(rows.length).toBe(1);
    const row = rows[0]!;
    expect(row.actorId).toBeNull();
    expect(row.action).toBe('intake.rejected');
    expect(row.metadata).toEqual({ submissionId: submission.id, apiKeyPrefix: keyPrefix });
    // The error message itself (which does legitimately live on the
    // WebsiteSubmission row's own `error` column) must still never appear
    // in the audit row's metadata, and the row must still carry no secret
    // or personal data.
    assertNoSecretsOrPersonalData(row, key, idempotencyKey);
  });
});
