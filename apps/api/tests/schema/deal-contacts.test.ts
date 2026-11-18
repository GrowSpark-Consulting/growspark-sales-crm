import { afterEach, describe, it } from 'vitest';
import { prisma } from '../../src/db/prisma.js';
import {
  PG_ERROR,
  cleanupOrganization,
  createTestCompany,
  createTestContact,
  createTestDeal,
  createTestOrganization,
  createTestPipeline,
  expectRejection,
} from './helpers.js';

let organizationId: string | undefined;

afterEach(async () => {
  if (organizationId) {
    await cleanupOrganization(organizationId);
    organizationId = undefined;
  }
});

describe('deal_contacts composite PK (dealId, contactId)', () => {
  it('rejects linking the same contact to a deal twice', async () => {
    const org = await createTestOrganization('DealContactDup');
    organizationId = org.id;
    const company = await createTestCompany(org.id);
    const { pipeline, stage } = await createTestPipeline(org.id);
    const deal = await createTestDeal(org.id, company.id, pipeline.id, stage.id);
    const contact = await createTestContact(org.id);

    await prisma.dealContact.create({
      data: { organizationId: org.id, dealId: deal.id, contactId: contact.id },
    });

    await expectRejection(
      prisma.dealContact.create({
        data: { organizationId: org.id, dealId: deal.id, contactId: contact.id },
      }),
      PG_ERROR.UNIQUE_VIOLATION,
      'deal_contacts_pkey',
    );
  });
});
