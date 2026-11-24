import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { createTwoTestTenants } from '../helpers/tenant.js';
import { createTestApiKey } from '../helpers/api-key.js';
import { ensureWebsiteLeadSource, intakeRequest } from '../helpers/intake.js';
import { prisma } from '../../src/db/prisma.js';

describe('Website intake: cross-organisation isolation', () => {
  it("two different organisations' API keys can reuse the same Idempotency-Key value independently, each creating its own Lead", async () => {
    const [orgA, orgB] = await createTwoTestTenants();
    await Promise.all([ensureWebsiteLeadSource(orgA), ensureWebsiteLeadSource(orgB)]);
    const { key: keyA } = await createTestApiKey(orgA);
    const { key: keyB } = await createTestApiKey(orgB);
    const app = createApp();

    const resA = await intakeRequest(app, keyA, 'shared-external-id', {
      formType: 'contact',
      fields: { name: 'Org A Person', email: 'a@example.com' },
    });
    const resB = await intakeRequest(app, keyB, 'shared-external-id', {
      formType: 'contact',
      fields: { name: 'Org B Person', email: 'b@example.com' },
    });

    expect(resA.status).toBe(201);
    expect(resB.status).toBe(201);
    expect(resA.body.data.leadId).not.toBe(resB.body.data.leadId);

    const leadA = await prisma.lead.findUniqueOrThrow({ where: { id: resA.body.data.leadId as string } });
    const leadB = await prisma.lead.findUniqueOrThrow({ where: { id: resB.body.data.leadId as string } });
    expect(leadA.organizationId).toBe(orgA.organization.id);
    expect(leadB.organizationId).toBe(orgB.organization.id);
  });

  it("Org A's duplicate-email warning never surfaces an Org B lead's id, even with the identical email address", async () => {
    const [orgA, orgB] = await createTwoTestTenants();
    await Promise.all([ensureWebsiteLeadSource(orgA), ensureWebsiteLeadSource(orgB)]);
    const { key: keyA } = await createTestApiKey(orgA);
    const { key: keyB } = await createTestApiKey(orgB);
    const app = createApp();

    await intakeRequest(app, keyB, 'org-b-first', {
      formType: 'contact',
      fields: { name: 'Org B', email: 'shared-email@example.com' },
    });
    const resA = await intakeRequest(app, keyA, 'org-a-first', {
      formType: 'contact',
      fields: { name: 'Org A', email: 'shared-email@example.com' },
    });
    expect(resA.status).toBe(201);
    expect(resA.body.data.possibleDuplicateLeadIds).toEqual([]);
  });
});
