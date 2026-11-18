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

describe('website_submissions unique (organizationId, externalId)', () => {
  it('rejects a duplicate externalId within the same organization', async () => {
    const org = await createTestOrganization('SubmissionDup');
    organizationId = org.id;

    await prisma.websiteSubmission.create({
      data: {
        organizationId: org.id,
        externalId: 'ext-123',
        formType: 'contact',
        payload: { foo: 'bar' },
      },
    });

    await expectRejection(
      prisma.websiteSubmission.create({
        data: {
          organizationId: org.id,
          externalId: 'ext-123',
          formType: 'contact',
          payload: { foo: 'baz' },
        },
      }),
      PG_ERROR.UNIQUE_VIOLATION,
      'website_submissions_organization_id_external_id_key',
    );
  });
});
