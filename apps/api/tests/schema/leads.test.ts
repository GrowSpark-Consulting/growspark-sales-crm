import { afterEach, describe, it } from 'vitest';
import { prisma } from '../../src/db/prisma.js';
import {
  PG_ERROR,
  cleanupOrganization,
  createTestLeadSource,
  createTestOrganization,
  expectRejection,
} from './helpers.js';

let organizationId: string | undefined;

afterEach(async () => {
  if (organizationId) {
    await cleanupOrganization(organizationId);
    organizationId = undefined;
  }
});

describe('leads_has_email_or_phone CHECK', () => {
  it('rejects a lead with neither email nor phone normalized', async () => {
    const org = await createTestOrganization('LeadNoContact');
    organizationId = org.id;
    const source = await createTestLeadSource(org.id);

    await expectRejection(
      prisma.lead.create({
        data: { organizationId: org.id, firstName: 'No Contact', sourceId: source.id },
      }),
      PG_ERROR.CHECK_VIOLATION,
      'leads_has_email_or_phone',
    );
  });

  it('rejects a lead with emailNormalized blank and phoneNormalized null', async () => {
    const org = await createTestOrganization('LeadBlankEmail');
    organizationId = org.id;
    const source = await createTestLeadSource(org.id);

    await expectRejection(
      prisma.lead.create({
        data: {
          organizationId: org.id,
          firstName: 'Blank Email',
          sourceId: source.id,
          emailNormalized: '',
          phoneNormalized: null,
        },
      }),
      PG_ERROR.CHECK_VIOLATION,
      'leads_has_email_or_phone',
    );
  });
});
