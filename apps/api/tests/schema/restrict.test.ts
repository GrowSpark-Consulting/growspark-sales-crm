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

describe('onDelete: Restrict', () => {
  it('refuses to delete a lead_source that a lead still references', async () => {
    const org = await createTestOrganization('RestrictDelete');
    organizationId = org.id;
    const source = await createTestLeadSource(org.id);
    await prisma.lead.create({
      data: {
        organizationId: org.id,
        firstName: 'Blocks Delete',
        sourceId: source.id,
        emailNormalized: 'blocks@example.test',
      },
    });

    await expectRejection(
      prisma.leadSource.delete({ where: { id: source.id } }),
      PG_ERROR.FK_VIOLATION,
      'leads_source_id_fkey',
    );
  });
});
