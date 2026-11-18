import { afterEach, describe, it } from 'vitest';
import { prisma } from '../../src/db/prisma.js';
import {
  PG_ERROR,
  cleanupOrganization,
  createTestCompany,
  createTestContact,
  createTestLeadSource,
  createTestOrganization,
  createTestUser,
  expectRejection,
} from './helpers.js';

let organizationId: string | undefined;

afterEach(async () => {
  if (organizationId) {
    await cleanupOrganization(organizationId);
    organizationId = undefined;
  }
});

describe('lead_conversions unique (leadId)', () => {
  it('rejects a second conversion for the same lead', async () => {
    const org = await createTestOrganization('LeadConversionDup');
    organizationId = org.id;
    const user = await createTestUser(org.id);
    const source = await createTestLeadSource(org.id);
    const lead = await prisma.lead.create({
      data: {
        organizationId: org.id,
        firstName: 'Convert Me',
        sourceId: source.id,
        emailNormalized: 'convert@example.test',
      },
    });
    const company = await createTestCompany(org.id);
    const contact = await createTestContact(org.id);

    await prisma.leadConversion.create({
      data: {
        organizationId: org.id,
        leadId: lead.id,
        companyId: company.id,
        contactId: contact.id,
        createdCompany: false,
        createdContact: false,
        convertedById: user.id,
      },
    });

    await expectRejection(
      prisma.leadConversion.create({
        data: {
          organizationId: org.id,
          leadId: lead.id,
          companyId: company.id,
          contactId: contact.id,
          createdCompany: false,
          createdContact: false,
          convertedById: user.id,
        },
      }),
      PG_ERROR.UNIQUE_VIOLATION,
      'lead_conversions_lead_id_key',
    );
  });
});
