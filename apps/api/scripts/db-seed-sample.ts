import { prisma } from '../src/db/prisma.js';
import { env } from '../src/env.js';
import { orgDayBounds, orgDateKey, addOrgDays } from '../src/lib/org-time.js';

const PREFIX = 'Sample CRM';

async function main(): Promise<void> {
  if (env.NODE_ENV === 'production') throw new Error('The sample CRM seed refuses to run in production.');
  const organization = await prisma.organization.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!organization) throw new Error('No organization found. Run `pnpm db:seed` first.');
  const owner = await prisma.user.findFirst({ where: { organizationId: organization.id, role: 'ADMIN', isActive: true }, orderBy: { createdAt: 'asc' } });
  const pipeline = await prisma.pipeline.findFirst({ where: { organizationId: organization.id, isDefault: true } });
  const source = await prisma.leadSource.findFirst({ where: { organizationId: organization.id, name: 'Manual' } });
  if (!owner || !pipeline || !source) throw new Error('Seed an active user, default pipeline and Manual lead source first.');
  const stages = await prisma.pipelineStage.findMany({ where: { organizationId: organization.id, pipelineId: pipeline.id } });
  const openStage = stages.find((stage) => stage.type === 'OPEN');
  const wonStage = stages.find((stage) => stage.type === 'WON');
  const lostStage = stages.find((stage) => stage.type === 'LOST');
  if (!openStage || !wonStage || !lostStage) throw new Error('The default pipeline needs OPEN, WON and LOST stages.');

  const companies = [];
  for (let index = 1; index <= 3; index += 1) {
    const name = `${PREFIX} Company ${index}`;
    let company = await prisma.company.findFirst({ where: { organizationId: organization.id, name } });
    if (!company) company = await prisma.company.create({ data: { organizationId: organization.id, name, nameNormalized: name.toLowerCase(), ownerId: owner.id } });
    companies.push(company);
  }
  const contacts = [];
  for (let index = 1; index <= 3; index += 1) {
    const email = `sample.contact.${index}@example.test`;
    let contact = await prisma.contact.findFirst({ where: { organizationId: organization.id, emailNormalized: email } });
    if (!contact) contact = await prisma.contact.create({ data: {
      organizationId: organization.id, companyId: companies[index - 1]!.id,
      firstName: ['Asha', 'Ravi', 'Mina'][index - 1]!, lastName: 'Sample', email, emailNormalized: email,
      ownerId: owner.id,
    } });
    contacts.push(contact);
  }

  const statuses = ['NEW', 'CONTACTED', 'QUALIFIED', 'UNQUALIFIED', 'CONVERTED'] as const;
  const leads = [];
  for (let index = 1; index <= 5; index += 1) {
    const email = `sample.lead.${index}@example.test`;
    let lead = await prisma.lead.findFirst({ where: { organizationId: organization.id, emailNormalized: email } });
    if (!lead) lead = await prisma.lead.create({ data: {
      organizationId: organization.id, firstName: `Sample Lead ${index}`, email, emailNormalized: email,
      companyName: companies[(index - 1) % companies.length]!.name,
      sourceId: source.id, status: statuses[index - 1]!, convertedAt: statuses[index - 1] === 'CONVERTED' ? new Date() : null,
      ownerId: owner.id,
    } });
    leads.push(lead);
  }

  const deals = [];
  const dealSpecs = [
    { name: `${PREFIX} Open Deal`, status: 'OPEN' as const, stage: openStage, value: '250000.00', probability: openStage.probability },
    { name: `${PREFIX} Won Deal`, status: 'WON' as const, stage: wonStage, value: '125000.00', probability: 100 },
    { name: `${PREFIX} Lost Deal`, status: 'LOST' as const, stage: lostStage, value: '90000.00', probability: 0 },
    { name: `${PREFIX} Closing Soon`, status: 'OPEN' as const, stage: openStage, value: '65000.00', probability: openStage.probability,
      expectedCloseDate: new Date(`${orgDateKey(addOrgDays(new Date(), 7, organization.timezone), organization.timezone)}T00:00:00.000Z`) },
  ];
  for (let index = 0; index < dealSpecs.length; index += 1) {
    const spec = dealSpecs[index]!;
    let deal = await prisma.deal.findFirst({ where: { organizationId: organization.id, name: spec.name } });
    if (!deal) deal = await prisma.deal.create({ data: {
      organizationId: organization.id, name: spec.name, companyId: companies[index % companies.length]!.id,
      pipelineId: pipeline.id, stageId: spec.stage.id, status: spec.status, value: spec.value,
      probability: spec.probability, ownerId: owner.id,
      ...('expectedCloseDate' in spec ? { expectedCloseDate: spec.expectedCloseDate } : {}),
      closedAt: spec.status === 'OPEN' ? null : new Date(), lostReason: spec.status === 'LOST' ? 'Price' : null,
    } });
    deals.push(deal);
  }
  for (let index = 0; index < deals.length; index += 1) {
    const deal = deals[index]!;
    const contact = contacts[index % contacts.length]!;
    const exists = await prisma.dealContact.findUnique({ where: { dealId_contactId: { dealId: deal.id, contactId: contact.id } } });
    if (!exists) await prisma.dealContact.create({ data: { organizationId: organization.id, dealId: deal.id, contactId: contact.id, isPrimary: true } });
  }

  const now = new Date();
  const today = orgDayBounds(now, organization.timezone);
  for (let index = 1; index <= 12; index += 1) {
    const type = index <= 3 ? 'TASK' : index <= 6 ? 'MEETING' : index <= 9 ? 'CALL' : 'NOTE';
    const subject = `${PREFIX} ${type} ${index}`;
    const exists = await prisma.activity.findFirst({ where: { organizationId: organization.id, subject } });
    if (exists) continue;
    const dueAt = index <= 3 ? new Date(today.start.getTime() - index * 60 * 60 * 1000)
      : type === 'TASK' ? addOrgDays(today.start, index, organization.timezone) : null;
    const done = type === 'NOTE';
    await prisma.activity.create({ data: {
      organizationId: organization.id, type, subject, description: 'Fictional sample data for local development.',
      status: done ? 'DONE' : 'OPEN', completedAt: done ? now : null, dueAt,
      startAt: type === 'MEETING' ? addOrgDays(today.start, index - 3, organization.timezone) : null,
      endAt: type === 'MEETING' ? new Date(addOrgDays(today.start, index - 3, organization.timezone).getTime() + 60 * 60 * 1000) : null,
      assigneeId: owner.id, createdById: owner.id, companyId: companies[(index - 1) % companies.length]!.id,
      dealId: index <= 3 ? deals[0]!.id : null,
      leadId: index % 2 === 0 ? leads[(index - 1) % leads.length]!.id : null,
    } });
  }
  const todayTaskSubject = `${PREFIX} TASK Due Today`;
  if (!await prisma.activity.findFirst({ where: { organizationId: organization.id, subject: todayTaskSubject } })) {
    await prisma.activity.create({ data: {
      organizationId: organization.id, type: 'TASK', subject: todayTaskSubject,
      description: 'Fictional sample data for local development.', status: 'OPEN', priority: 'MEDIUM',
      dueAt: new Date(today.start.getTime() + 60 * 60 * 1000), assigneeId: owner.id, createdById: owner.id,
      companyId: companies[0]!.id,
    } });
  }
  const todayMeetingSubject = `${PREFIX} MEETING Today`;
  if (!await prisma.activity.findFirst({ where: { organizationId: organization.id, subject: todayMeetingSubject } })) {
    const startAt = new Date(today.start.getTime() + 10 * 60 * 60 * 1000);
    await prisma.activity.create({ data: {
      organizationId: organization.id, type: 'MEETING', subject: todayMeetingSubject,
      description: 'Fictional sample data for local development.', status: 'OPEN', priority: 'MEDIUM',
      startAt, endAt: new Date(startAt.getTime() + 60 * 60 * 1000), assigneeId: owner.id, createdById: owner.id,
      companyId: companies[0]!.id,
    } });
  }
  process.stdout.write('Sample CRM data is ready (3 companies, 3 contacts, 5 leads, 4 deals, 14 activities).\n');
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Sample seed failed.'}\n`);
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());
