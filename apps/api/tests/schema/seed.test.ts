import { describe, expect, it } from 'vitest';
import { prisma } from '../../src/db/prisma.js';
import { runSeed } from '../../prisma/seed-lib.js';

async function getCounts() {
  const org = await prisma.organization.findFirst({
    where: { name: 'Grow Spark Consulting' },
  });
  if (!org) {
    throw new Error('seed did not create the Grow Spark Consulting organization');
  }
  return {
    organizations: await prisma.organization.count({ where: { name: 'Grow Spark Consulting' } }),
    users: await prisma.user.count({ where: { organizationId: org.id } }),
    leadSources: await prisma.leadSource.count({ where: { organizationId: org.id } }),
    pipelines: await prisma.pipeline.count({ where: { organizationId: org.id } }),
    pipelineStages: await prisma.pipelineStage.count({ where: { organizationId: org.id } }),
  };
}

describe('seed idempotency', () => {
  it('produces identical row counts when run twice', async () => {
    await runSeed();
    const first = await getCounts();

    await runSeed();
    const second = await getCounts();

    expect(second).toEqual(first);
    expect(first).toEqual({
      organizations: 1,
      users: 2,
      leadSources: 7,
      pipelines: 1,
      pipelineStages: 6,
    });
  });
});
