import { randomUUID } from 'node:crypto';
import { hash } from '@node-rs/argon2';
import { prisma } from '../../src/db/prisma.js';
import type { User, Organization, LeadSource, Pipeline, PipelineStage } from '../../src/generated/prisma/client.js';

/** Fixed, dev-only passwords — fine to hard-code, these never touch a real database. */
export const TEST_ADMIN_PASSWORD = 'Correct-Horse-Admin-1';
export const TEST_STAFF_PASSWORD = 'Correct-Horse-Staff-1';

/**
 * Mirrors the real seed's stage list exactly (apps/api/prisma/seed-lib.ts,
 * D10) — Day 3's conversion/deal tests need a real pipeline with the same
 * shape production data has, not an arbitrary test fixture.
 */
const PIPELINE_STAGES = [
  { name: 'Qualification', position: 1, probability: 10, type: 'OPEN' as const },
  { name: 'Needs Analysis', position: 2, probability: 25, type: 'OPEN' as const },
  { name: 'Proposal', position: 3, probability: 50, type: 'OPEN' as const },
  { name: 'Negotiation', position: 4, probability: 75, type: 'OPEN' as const },
  { name: 'Won', position: 5, probability: 100, type: 'WON' as const },
  { name: 'Lost', position: 6, probability: 0, type: 'LOST' as const },
];

export interface TestTenant {
  organization: Organization;
  adminUser: User;
  adminPassword: string;
  staffUser: User;
  staffPassword: string;
  leadSource: LeadSource;
  pipeline: Pipeline;
  /** Ordered by position, same order as PIPELINE_STAGES (and the real seed). */
  stages: PipelineStage[];
}

/**
 * Creates one fully-formed organisation for a test: an Admin and a Staff user
 * (real argon2id hashes, known plaintext passwords so login/session tests can
 * authenticate), and a lead source. Every call uses fresh random names/emails,
 * so it is safe to call more than once in the same test run.
 */
export async function createTestTenant(namePrefix = 'Test Org'): Promise<TestTenant> {
  const organization = await prisma.organization.create({
    data: { name: `${namePrefix}-${randomUUID()}` },
  });

  const [adminUser, staffUser, leadSource] = await Promise.all([
    prisma.user.create({
      data: {
        organizationId: organization.id,
        email: `admin-${randomUUID()}@example.test`,
        name: 'Test Admin',
        passwordHash: await hash(TEST_ADMIN_PASSWORD),
        role: 'ADMIN',
      },
    }),
    prisma.user.create({
      data: {
        organizationId: organization.id,
        email: `staff-${randomUUID()}@example.test`,
        name: 'Test Staff',
        passwordHash: await hash(TEST_STAFF_PASSWORD),
        role: 'STAFF',
      },
    }),
    prisma.leadSource.create({
      data: { organizationId: organization.id, name: `Source-${randomUUID()}`, sortOrder: 1 },
    }),
  ]);

  const pipeline = await prisma.pipeline.create({
    data: { organizationId: organization.id, name: 'Sales Pipeline', isDefault: true },
  });
  const stages = await Promise.all(
    PIPELINE_STAGES.map((stage) =>
      prisma.pipelineStage.create({
        data: {
          organizationId: organization.id,
          pipelineId: pipeline.id,
          name: stage.name,
          position: stage.position,
          probability: stage.probability,
          type: stage.type,
        },
      }),
    ),
  );

  return {
    organization,
    adminUser,
    adminPassword: TEST_ADMIN_PASSWORD,
    staffUser,
    staffPassword: TEST_STAFF_PASSWORD,
    leadSource,
    pipeline,
    stages,
  };
}

/** Two independent tenants, for cross-organisation data-isolation tests. */
export async function createTwoTestTenants(): Promise<[TestTenant, TestTenant]> {
  return Promise.all([createTestTenant('Org A'), createTestTenant('Org B')]);
}
