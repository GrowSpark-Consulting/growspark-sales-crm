import { afterEach, describe, expect, it } from 'vitest';
import { prisma } from '../../src/db/prisma.js';
import {
  PG_ERROR,
  cleanupOrganization,
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

describe('activities_has_link CHECK', () => {
  it('rejects an activity with no lead/contact/company/deal link', async () => {
    const org = await createTestOrganization('ActivityNoLink');
    organizationId = org.id;
    const user = await createTestUser(org.id);

    await expectRejection(
      prisma.activity.create({
        data: {
          organizationId: org.id,
          type: 'TASK',
          subject: 'No link',
          createdById: user.id,
        },
      }),
      PG_ERROR.CHECK_VIOLATION,
      'activities_has_link',
    );
  });

  it('accepts an activity with exactly one link', async () => {
    const org = await createTestOrganization('ActivityOneLink');
    organizationId = org.id;
    const user = await createTestUser(org.id);
    const source = await createTestLeadSource(org.id);
    const lead = await prisma.lead.create({
      data: {
        organizationId: org.id,
        firstName: 'Linked',
        sourceId: source.id,
        emailNormalized: 'linked@example.test',
      },
    });

    const activity = await prisma.activity.create({
      data: {
        organizationId: org.id,
        type: 'TASK',
        subject: 'Has link',
        createdById: user.id,
        leadId: lead.id,
      },
    });

    expect(activity.leadId).toBe(lead.id);
  });
});
