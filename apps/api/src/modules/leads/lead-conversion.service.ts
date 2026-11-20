import { normalizeCompanyName } from '@growspark/shared';
import type { ConvertLeadInput, LeadConversionMatchesResponse, LeadConversionResponse } from '@growspark/shared';
import { prisma } from '../../db/prisma.js';
import { ApiError } from '../../middleware/error-handler.js';
import { scoped } from '../../lib/scoped.js';
import { writeAudit } from '../../lib/audit.js';
import type { RequestContext } from '../../lib/context.js';
import type { Prisma } from '../../generated/prisma/client.js';

/**
 * Day 3 brief: suggests existing companies (normalised name) and contacts
 * (normalised email/phone) for the conversion dialog to offer as "link to
 * this instead" choices — organisation-scoped, archived excluded. Never
 * blocks anything (same D29 "duplicates warn" spirit); a plain read.
 */
export async function getLeadConversionMatches(
  ctx: RequestContext,
  leadId: string,
): Promise<LeadConversionMatchesResponse['data']> {
  const lead = await prisma.lead.findFirst({ where: { id: leadId, ...scoped(ctx) } });
  if (!lead) {
    throw new ApiError(404, 'NOT_FOUND', 'Lead not found');
  }

  const [companies, contacts] = await Promise.all([
    lead.companyNameNormalized
      ? prisma.company.findMany({
          where: { ...scoped(ctx), archivedAt: null, nameNormalized: lead.companyNameNormalized },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        })
      : Promise.resolve([]),
    lead.emailNormalized || lead.phoneNormalized
      ? prisma.contact.findMany({
          where: {
            ...scoped(ctx),
            archivedAt: null,
            OR: [
              ...(lead.emailNormalized ? [{ emailNormalized: lead.emailNormalized }] : []),
              ...(lead.phoneNormalized ? [{ phoneNormalized: lead.phoneNormalized }] : []),
            ],
          },
          select: { id: true, firstName: true, lastName: true, email: true },
          orderBy: { firstName: 'asc' },
        })
      : Promise.resolve([]),
  ]);

  return { companies, contacts };
}

/**
 * The hardest part of Day 3: turns a QUALIFIED lead into a Company, a
 * Contact, and optionally a Deal, in one transaction. Every step below
 * follows the brief's own numbered rules; see docs/decisions.md for the
 * judgment calls flagged inline.
 */
export async function convertLead(
  ctx: RequestContext,
  leadId: string,
  input: ConvertLeadInput,
): Promise<LeadConversionResponse['data']> {
  return prisma.$transaction(async (tx) => {
    // 1. Lock the lead row before anything else reads or writes it, so two
    // concurrent conversion attempts serialise rather than race.
    const locked = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM leads WHERE id = ${leadId}::uuid AND organization_id = ${ctx.orgId}::uuid FOR UPDATE
    `;
    if (locked.length === 0) {
      throw new ApiError(404, 'NOT_FOUND', 'Lead not found');
    }

    const lead = await tx.lead.findFirstOrThrow({ where: { id: leadId, ...scoped(ctx) } });

    if (lead.archivedAt) {
      throw new ApiError(409, 'CONFLICT', 'An archived lead cannot be converted.');
    }
    if (lead.status === 'CONVERTED') {
      throw new ApiError(409, 'CONFLICT', 'This lead has already been converted.');
    }
    if (lead.status !== 'QUALIFIED') {
      throw new ApiError(409, 'CONFLICT', 'Only a qualified lead can be converted.');
    }

    // 2. Company: link the chosen existing company, or create one from the
    // lead's own company fields.
    let companyId: string;
    let companyName: string;
    let createdCompany = false;
    if (input.companyId) {
      const company = await tx.company.findFirst({ where: { id: input.companyId, ...scoped(ctx) } });
      if (!company) {
        throw new ApiError(404, 'NOT_FOUND', 'Company not found');
      }
      companyId = company.id;
      companyName = company.name;
    } else {
      const name = lead.companyName?.trim();
      if (!name) {
        throw new ApiError(422, 'VALIDATION_FAILED', 'This lead has no company name — link an existing company instead.', [
          { path: 'companyId', message: 'Required when the lead has no company name' },
        ]);
      }
      const company = await tx.company.create({
        data: {
          organizationId: ctx.orgId,
          name,
          nameNormalized: normalizeCompanyName(name)!,
          website: lead.website,
          industry: lead.industry,
          ownerId: lead.ownerId,
        },
      });
      companyId = company.id;
      companyName = company.name;
      createdCompany = true;
    }

    // 3. Contact: link the chosen existing contact and fill ONLY empty
    // fields from the lead, or create a new one under the company. An
    // existing contact's company is never overwritten, even if it has none.
    let contactId: string;
    let createdContact = false;
    if (input.contactId) {
      const existing = await tx.contact.findFirst({ where: { id: input.contactId, ...scoped(ctx) } });
      if (!existing) {
        throw new ApiError(404, 'NOT_FOUND', 'Contact not found');
      }
      const fill: Prisma.ContactUpdateInput = {};
      if (!existing.lastName && lead.lastName) fill.lastName = lead.lastName;
      if (!existing.email && lead.email) {
        fill.email = lead.email;
        fill.emailNormalized = lead.emailNormalized;
      }
      if (!existing.phone && lead.phone) {
        fill.phone = lead.phone;
        fill.phoneNormalized = lead.phoneNormalized;
      }
      if (!existing.jobTitle && lead.jobTitle) fill.jobTitle = lead.jobTitle;
      const contact = Object.keys(fill).length > 0 ? await tx.contact.update({ where: { id: existing.id }, data: fill }) : existing;
      contactId = contact.id;
    } else {
      const contact = await tx.contact.create({
        data: {
          organizationId: ctx.orgId,
          companyId,
          firstName: lead.firstName,
          lastName: lead.lastName,
          email: lead.email,
          emailNormalized: lead.emailNormalized,
          phone: lead.phone,
          phoneNormalized: lead.phoneNormalized,
          jobTitle: lead.jobTitle,
          ownerId: lead.ownerId,
        },
      });
      contactId = contact.id;
      createdContact = true;
    }

    // 4. Optionally create the deal in the first open stage: probability
    // copied from the stage, primary contact attached, first stage-history
    // row.
    let dealId: string | null = null;
    if (input.createDeal) {
      const pipeline =
        (await tx.pipeline.findFirst({ where: { organizationId: ctx.orgId, isDefault: true } })) ??
        (await tx.pipeline.findFirst({ where: { organizationId: ctx.orgId } }));
      if (!pipeline) {
        throw new ApiError(500, 'INTERNAL', 'No pipeline is configured for this organisation.');
      }
      const firstStage = await tx.pipelineStage.findFirst({
        where: { organizationId: ctx.orgId, pipelineId: pipeline.id, type: 'OPEN' },
        orderBy: { position: 'asc' },
      });
      if (!firstStage) {
        throw new ApiError(500, 'INTERNAL', 'No open pipeline stage is configured for this organisation.');
      }
      if (input.deal?.ownerId) {
        const owner = await tx.user.findFirst({ where: { id: input.deal.ownerId, organizationId: ctx.orgId } });
        if (!owner) {
          throw new ApiError(404, 'NOT_FOUND', 'Owner not found');
        }
      }

      const dealName =
        input.deal?.name?.trim() || `${companyName} - ${[lead.firstName, lead.lastName].filter(Boolean).join(' ')}`;

      const deal = await tx.deal.create({
        data: {
          organizationId: ctx.orgId,
          name: dealName,
          companyId,
          pipelineId: pipeline.id,
          stageId: firstStage.id,
          probability: firstStage.probability,
          value: input.deal?.value ?? 0,
          expectedCloseDate: input.deal?.expectedCloseDate ? new Date(input.deal.expectedCloseDate) : null,
          ownerId: input.deal?.ownerId ?? lead.ownerId ?? ctx.userId,
          dealType: input.deal?.dealType ?? null,
          sourceId: lead.sourceId,
        },
      });
      await tx.dealContact.create({
        data: { organizationId: ctx.orgId, dealId: deal.id, contactId, isPrimary: true },
      });
      await tx.dealStageHistory.create({
        data: {
          organizationId: ctx.orgId,
          dealId: deal.id,
          fromStageId: null,
          toStageId: firstStage.id,
          changedById: ctx.userId,
        },
      });
      dealId = deal.id;
    }

    // 5. Convert the lead, write its history and conversion record, repoint
    // its activities (none may exist yet — Day 4 — but the code must still
    // be correct once they do), and audit the whole action.
    await tx.lead.update({ where: { id: lead.id }, data: { status: 'CONVERTED', convertedAt: new Date() } });
    await tx.leadStatusHistory.create({
      data: {
        organizationId: ctx.orgId,
        leadId: lead.id,
        fromStatus: lead.status,
        toStatus: 'CONVERTED',
        changedById: ctx.userId,
      },
    });
    await tx.leadConversion.create({
      data: {
        organizationId: ctx.orgId,
        leadId: lead.id,
        companyId,
        contactId,
        dealId,
        createdCompany,
        createdContact,
        convertedById: ctx.userId,
      },
    });
    await tx.activity.updateMany({
      where: { organizationId: ctx.orgId, leadId: lead.id },
      data: { contactId, companyId, ...(dealId ? { dealId } : {}) },
    });
    await writeAudit(tx, ctx, {
      action: 'lead.converted',
      entityType: 'lead',
      entityId: lead.id,
      metadata: { companyId, contactId, dealId, createdCompany, createdContact },
    });

    return { leadId: lead.id, companyId, contactId, dealId, createdCompany, createdContact };
  });
}
