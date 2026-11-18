import { afterEach, describe, it } from 'vitest';
import { prisma } from '../../src/db/prisma.js';
import {
  PG_ERROR,
  cleanupOrganization,
  createTestCompany,
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

async function setup(prefix: string) {
  const org = await createTestOrganization(prefix);
  organizationId = org.id;
  const company = await createTestCompany(org.id);
  const { pipeline, stage } = await createTestPipeline(org.id);
  return { org, company, pipeline, stage };
}

describe('deals_probability_range CHECK', () => {
  it('rejects a deal with probability 101', async () => {
    const { org, company, pipeline, stage } = await setup('DealProbHigh');

    await expectRejection(
      prisma.deal.create({
        data: {
          organizationId: org.id,
          name: 'Too High',
          companyId: company.id,
          pipelineId: pipeline.id,
          stageId: stage.id,
          probability: 101,
        },
      }),
      PG_ERROR.CHECK_VIOLATION,
      'deals_probability_range',
    );
  });
});

describe('deals_value_non_negative CHECK', () => {
  it('rejects a deal with a negative value', async () => {
    const { org, company, pipeline, stage } = await setup('DealNegValue');

    await expectRejection(
      prisma.deal.create({
        data: {
          organizationId: org.id,
          name: 'Negative',
          companyId: company.id,
          pipelineId: pipeline.id,
          stageId: stage.id,
          probability: 10,
          value: -1,
        },
      }),
      PG_ERROR.CHECK_VIOLATION,
      'deals_value_non_negative',
    );
  });
});

describe('deals_lost_requires_reason CHECK', () => {
  it('rejects a LOST deal with no lost_reason', async () => {
    const { org, company, pipeline, stage } = await setup('DealLostNoReason');

    await expectRejection(
      prisma.deal.create({
        data: {
          organizationId: org.id,
          name: 'Lost, no reason',
          companyId: company.id,
          pipelineId: pipeline.id,
          stageId: stage.id,
          probability: 0,
          status: 'LOST',
          closedAt: new Date(),
        },
      }),
      PG_ERROR.CHECK_VIOLATION,
      'deals_lost_requires_reason',
    );
  });

  it('rejects a LOST deal with a blank (whitespace-only) lost_reason', async () => {
    const { org, company, pipeline, stage } = await setup('DealLostBlankReason');

    await expectRejection(
      prisma.deal.create({
        data: {
          organizationId: org.id,
          name: 'Lost, blank reason',
          companyId: company.id,
          pipelineId: pipeline.id,
          stageId: stage.id,
          probability: 0,
          status: 'LOST',
          closedAt: new Date(),
          lostReason: '   ',
        },
      }),
      PG_ERROR.CHECK_VIOLATION,
      'deals_lost_requires_reason',
    );
  });
});
