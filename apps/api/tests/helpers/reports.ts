import { randomUUID } from 'node:crypto';
import { prisma } from '../../src/db/prisma.js';
import type { ActivityType, DealStatus, LeadStatus, QuotationStatus } from '../../src/generated/prisma/client.js';
import type { TestTenant } from './tenant.js';

const DAY = 24 * 60 * 60 * 1000;

/**
 * A fixed reporting window that is always safely in the past: the calendar
 * month two months before today (organisation zone Asia/Kolkata, the test
 * tenants' default). Anything dated inside it is "overdue" by now, and
 * nothing a test creates "now" falls inside it by accident.
 */
export function pastMonth() {
  const now = new Date();
  const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1));
  const y = first.getUTCFullYear();
  const m = String(first.getUTCMonth() + 1).padStart(2, '0');
  const lastDay = new Date(Date.UTC(y, first.getUTCMonth() + 1, 0)).getUTCDate();
  return {
    from: `${y}-${m}-01`,
    to: `${y}-${m}-${String(lastDay).padStart(2, '0')}`,
    /** Noon IST on the given day of the window. */
    on: (day: number) => new Date(`${y}-${m}-${String(day).padStart(2, '0')}T06:30:00.000Z`),
    /** 00:30 IST on the 1st — still 31st/30th of the previous month in UTC. */
    firstMinuteIst: new Date(new Date(`${y}-${m}-01T00:00:00.000Z`).getTime() - 5 * 60 * 60 * 1000),
    /** 23:30 IST the day before the window starts (18:00 UTC): outside the window. */
    justBefore: new Date(new Date(`${y}-${m}-01T00:00:00.000Z`).getTime() - 6 * 60 * 60 * 1000),
    before: new Date(first.getTime() - 10 * DAY),
    after: new Date(Date.UTC(y, first.getUTCMonth() + 1, 5, 6, 30)),
  };
}

export async function seedLead(
  tenant: TestTenant,
  options: { createdAt: Date; status?: LeadStatus; ownerId?: string | null; sourceId?: string; archived?: boolean },
) {
  const email = `${randomUUID()}@example.test`;
  return prisma.lead.create({
    data: {
      organizationId: tenant.organization.id,
      firstName: 'Lead',
      email,
      emailNormalized: email,
      sourceId: options.sourceId ?? tenant.leadSource.id,
      status: options.status ?? 'NEW',
      convertedAt: options.status === 'CONVERTED' ? options.createdAt : null,
      ownerId: options.ownerId ?? null,
      createdAt: options.createdAt,
      archivedAt: options.archived ? new Date() : null,
    },
  });
}

export async function seedCompany(tenant: TestTenant, name = 'Example Foods') {
  return prisma.company.create({ data: { organizationId: tenant.organization.id, name, nameNormalized: name.toLowerCase() } });
}

export async function seedDeal(
  tenant: TestTenant,
  companyId: string,
  options: { value: string; status?: DealStatus; closedAt?: Date; ownerId?: string | null; stageIndex?: number; probability?: number; archived?: boolean },
) {
  const status = options.status ?? 'OPEN';
  const stage =
    status === 'WON' ? tenant.stages.find((s) => s.type === 'WON')! : status === 'LOST' ? tenant.stages.find((s) => s.type === 'LOST')! : tenant.stages[options.stageIndex ?? 0]!;
  return prisma.deal.create({
    data: {
      organizationId: tenant.organization.id,
      name: `Deal ${randomUUID().slice(0, 8)}`,
      companyId,
      pipelineId: tenant.pipeline.id,
      stageId: stage.id,
      status,
      value: options.value,
      probability: options.probability ?? stage.probability,
      ownerId: options.ownerId === undefined ? tenant.adminUser.id : options.ownerId,
      closedAt: status === 'OPEN' ? null : (options.closedAt ?? new Date()),
      lostReason: status === 'LOST' ? 'Price' : null,
      archivedAt: options.archived ? new Date() : null,
    },
  });
}

export async function seedQuotation(
  tenant: TestTenant,
  refs: { companyId: string; contactId: string },
  options: { issueDate: string; validUntil: string; total: string; status?: QuotationStatus; ownerId?: string | null; archived?: boolean },
) {
  return prisma.quotation.create({
    data: {
      organizationId: tenant.organization.id,
      number: `Q-T-${randomUUID().slice(0, 8)}`,
      companyId: refs.companyId,
      contactId: refs.contactId,
      ownerId: options.ownerId === undefined ? tenant.adminUser.id : options.ownerId,
      status: options.status ?? 'DRAFT',
      issueDate: new Date(`${options.issueDate}T00:00:00.000Z`),
      validUntil: new Date(`${options.validUntil}T00:00:00.000Z`),
      subtotal: options.total,
      taxAmount: 0,
      total: options.total,
      archivedAt: options.archived ? new Date() : null,
    },
  });
}

export async function seedContact(tenant: TestTenant, companyId: string) {
  return prisma.contact.create({
    data: { organizationId: tenant.organization.id, companyId, firstName: 'Asha', email: `${randomUUID()}@example.test`, emailNormalized: `${randomUUID()}@example.test` },
  });
}

export async function seedActivity(
  tenant: TestTenant,
  leadId: string,
  options: { dueAt: Date | null; type?: ActivityType; done?: boolean; assigneeId?: string | null },
) {
  return prisma.activity.create({
    data: {
      organizationId: tenant.organization.id,
      type: options.type ?? 'TASK',
      subject: 'Follow up',
      status: options.done ? 'DONE' : 'OPEN',
      completedAt: options.done ? new Date() : null,
      dueAt: options.dueAt,
      assigneeId: options.assigneeId === undefined ? tenant.staffUser.id : options.assigneeId,
      createdById: tenant.adminUser.id,
      leadId,
    },
  });
}
