import { hash } from '@node-rs/argon2';
import { prisma } from '../src/db/prisma.js';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`seed: ${name} is required`);
  }
  return value;
}

const PIPELINE_STAGES = [
  { name: 'Qualification', position: 1, probability: 10, type: 'OPEN' as const },
  { name: 'Needs Analysis', position: 2, probability: 25, type: 'OPEN' as const },
  { name: 'Proposal', position: 3, probability: 50, type: 'OPEN' as const },
  { name: 'Negotiation', position: 4, probability: 75, type: 'OPEN' as const },
  { name: 'Won', position: 5, probability: 100, type: 'WON' as const },
  { name: 'Lost', position: 6, probability: 0, type: 'LOST' as const },
];

const LEAD_SOURCES = [
  { name: 'Website', sortOrder: 1 },
  { name: 'Manual', sortOrder: 2 },
  { name: 'Referral', sortOrder: 3 },
  { name: 'LinkedIn', sortOrder: 4 },
  { name: 'Event', sortOrder: 5 },
  { name: 'Cold outreach', sortOrder: 6 },
  { name: 'Import', sortOrder: 7 },
];

export async function runSeed(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('seed: refusing to run with NODE_ENV=production');
  }

  // Organization has no unique key besides id, so find-or-create by name.
  let organization = await prisma.organization.findFirst({
    where: { name: 'Grow Spark Consulting' },
  });
  if (!organization) {
    organization = await prisma.organization.create({
      data: { name: 'Grow Spark Consulting', timezone: 'Asia/Kolkata', currency: 'INR' },
    });
  }
  const organizationId = organization.id;

  const adminPasswordHash = await hash(requireEnv('SEED_ADMIN_PASSWORD'));
  await prisma.user.upsert({
    where: { organizationId_email: { organizationId, email: 'admin@growspark.test' } },
    create: {
      organizationId,
      email: 'admin@growspark.test',
      name: 'Demo Admin',
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
    },
    update: { name: 'Demo Admin', passwordHash: adminPasswordHash, role: 'ADMIN' },
  });

  const staffPasswordHash = await hash(requireEnv('SEED_STAFF_PASSWORD'));
  await prisma.user.upsert({
    where: { organizationId_email: { organizationId, email: 'staff@growspark.test' } },
    create: {
      organizationId,
      email: 'staff@growspark.test',
      name: 'Demo Staff',
      passwordHash: staffPasswordHash,
      role: 'STAFF',
    },
    update: { name: 'Demo Staff', passwordHash: staffPasswordHash, role: 'STAFF' },
  });

  for (const source of LEAD_SOURCES) {
    await prisma.leadSource.upsert({
      where: { organizationId_name: { organizationId, name: source.name } },
      create: { organizationId, name: source.name, sortOrder: source.sortOrder },
      update: { sortOrder: source.sortOrder },
    });
  }

  const pipeline = await prisma.pipeline.upsert({
    where: { organizationId_name: { organizationId, name: 'Sales Pipeline' } },
    create: { organizationId, name: 'Sales Pipeline', isDefault: true },
    update: { isDefault: true },
  });

  for (const stage of PIPELINE_STAGES) {
    await prisma.pipelineStage.upsert({
      where: {
        organizationId_pipelineId_name: {
          organizationId,
          pipelineId: pipeline.id,
          name: stage.name,
        },
      },
      create: {
        organizationId,
        pipelineId: pipeline.id,
        name: stage.name,
        position: stage.position,
        probability: stage.probability,
        type: stage.type,
      },
      update: {
        position: stage.position,
        probability: stage.probability,
        type: stage.type,
      },
    });
  }
}
