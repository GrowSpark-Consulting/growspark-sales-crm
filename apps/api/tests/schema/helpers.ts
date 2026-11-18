import { randomUUID } from 'node:crypto';
import { prisma } from '../../src/db/prisma.js';
import type { Prisma } from '../../src/generated/prisma/client.js';

/** Real Postgres error codes Prisma 7 surfaces via the pg driver adapter. */
export const PG_ERROR = {
  CHECK_VIOLATION: 'P2039',
  UNIQUE_VIOLATION: 'P2002',
  FK_VIOLATION: 'P2003',
} as const;

export function isKnownRequestError(
  err: unknown,
): err is Prisma.PrismaClientKnownRequestError {
  return typeof err === 'object' && err !== null && 'code' in err && 'meta' in err;
}

/**
 * Awaits `promise`, asserts it rejected with a Prisma
 * PrismaClientKnownRequestError carrying `code`, and that the underlying
 * database error message names `constraintNameFragment` (the exact
 * constraint/index name, or a substring of it) — so the test fails loudly if
 * a *different* constraint rejected the row than the one being tested.
 */
export async function expectRejection(
  promise: Promise<unknown>,
  code: string,
  constraintNameFragment: string,
): Promise<void> {
  let caught: unknown;
  try {
    await promise;
  } catch (err) {
    caught = err;
  }
  if (!isKnownRequestError(caught)) {
    throw new Error(`Expected a PrismaClientKnownRequestError, got: ${String(caught)}`);
  }
  if (caught.code !== code) {
    throw new Error(`Expected error code ${code}, got ${caught.code}: ${caught.message}`);
  }
  if (!caught.message.includes(constraintNameFragment)) {
    throw new Error(
      `Expected error message to mention "${constraintNameFragment}", got: ${caught.message}`,
    );
  }
}

export async function createTestOrganization(namePrefix: string) {
  return prisma.organization.create({
    data: { name: `${namePrefix}-${randomUUID()}` },
  });
}

export async function createTestUser(organizationId: string, email?: string) {
  return prisma.user.create({
    data: {
      organizationId,
      email: email ?? `user-${randomUUID()}@example.test`,
      name: 'Test User',
      passwordHash: 'not-a-real-hash',
      role: 'ADMIN',
    },
  });
}

export async function createTestLeadSource(organizationId: string) {
  return prisma.leadSource.create({
    data: { organizationId, name: `Source-${randomUUID()}`, sortOrder: 1 },
  });
}

export async function createTestCompany(organizationId: string) {
  return prisma.company.create({
    data: { organizationId, name: 'Test Co', nameNormalized: 'test co' },
  });
}

export async function createTestContact(organizationId: string) {
  return prisma.contact.create({
    data: { organizationId, firstName: 'Test' },
  });
}

export async function createTestPipeline(organizationId: string) {
  const pipeline = await prisma.pipeline.create({
    data: { organizationId, name: `Pipeline-${randomUUID()}`, isDefault: false },
  });
  const stage = await prisma.pipelineStage.create({
    data: {
      organizationId,
      pipelineId: pipeline.id,
      name: 'Stage 1',
      position: 1,
      probability: 10,
      type: 'OPEN',
    },
  });
  return { pipeline, stage };
}

export async function createTestDeal(
  organizationId: string,
  companyId: string,
  pipelineId: string,
  stageId: string,
  overrides: Partial<Prisma.DealUncheckedCreateInput> = {},
) {
  return prisma.deal.create({
    data: {
      organizationId,
      name: 'Test Deal',
      companyId,
      pipelineId,
      stageId,
      probability: 10,
      ...overrides,
    },
  });
}

/**
 * Deletes everything under an organization in FK-safe (children-first) order,
 * then the organization itself. Every table is onDelete: Restrict, so order
 * matters.
 */
export async function cleanupOrganization(organizationId: string): Promise<void> {
  await prisma.activity.deleteMany({ where: { organizationId } });
  await prisma.dealContact.deleteMany({ where: { organizationId } });
  await prisma.dealStageHistory.deleteMany({ where: { organizationId } });
  await prisma.leadStatusHistory.deleteMany({ where: { organizationId } });
  await prisma.websiteSubmission.deleteMany({ where: { organizationId } });
  await prisma.leadConversion.deleteMany({ where: { organizationId } });
  await prisma.session.deleteMany({ where: { organizationId } });
  await prisma.apiKey.deleteMany({ where: { organizationId } });
  await prisma.auditEvent.deleteMany({ where: { organizationId } });
  await prisma.deal.deleteMany({ where: { organizationId } });
  await prisma.contact.deleteMany({ where: { organizationId } });
  await prisma.lead.deleteMany({ where: { organizationId } });
  await prisma.pipelineStage.deleteMany({ where: { organizationId } });
  await prisma.company.deleteMany({ where: { organizationId } });
  await prisma.pipeline.deleteMany({ where: { organizationId } });
  await prisma.leadSource.deleteMany({ where: { organizationId } });
  await prisma.user.deleteMany({ where: { organizationId } });
  await prisma.organization.delete({ where: { id: organizationId } });
}
