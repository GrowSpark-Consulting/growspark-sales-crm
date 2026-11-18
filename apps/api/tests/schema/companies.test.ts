import { afterEach, describe, it } from 'vitest';
import { prisma } from '../../src/db/prisma.js';
import { PG_ERROR, cleanupOrganization, createTestOrganization, expectRejection } from './helpers.js';

let organizationId: string | undefined;

afterEach(async () => {
  if (organizationId) {
    await cleanupOrganization(organizationId);
    organizationId = undefined;
  }
});

describe('companies_name_not_blank CHECK', () => {
  it('rejects a company with a blank (whitespace-only) name', async () => {
    const org = await createTestOrganization('CompanyBlankName');
    organizationId = org.id;

    await expectRejection(
      prisma.company.create({
        data: { organizationId: org.id, name: '   ', nameNormalized: 'whatever' },
      }),
      PG_ERROR.CHECK_VIOLATION,
      'companies_name_not_blank',
    );
  });
});
