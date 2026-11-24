import type { ListEnquiriesQuery, EnquiryResponse, EnquiryDetailResponse } from '@growspark/shared';
import { prisma } from '../../db/prisma.js';
import { ApiError } from '../../middleware/error-handler.js';
import { scoped } from '../../lib/scoped.js';
import { writeAudit } from '../../lib/audit.js';
import { toSkipTake, buildPaginationMeta } from '../../lib/pagination.js';
import { buildOrderBy } from '../../lib/list-query.js';
import type { RequestContext } from '../../lib/context.js';
import type { WebsiteSubmission, Prisma } from '../../generated/prisma/client.js';

function toEnquiryResponse(submission: WebsiteSubmission): EnquiryResponse {
  return {
    id: submission.id,
    externalId: submission.externalId,
    formType: submission.formType,
    receivedAt: submission.receivedAt.toISOString(),
    submittedAt: submission.submittedAt ? submission.submittedAt.toISOString() : null,
    sourcePage: submission.sourcePage,
    status: submission.status,
    error: submission.error,
    leadId: submission.leadId,
    archivedAt: submission.archivedAt ? submission.archivedAt.toISOString() : null,
    updatedAt: submission.updatedAt.toISOString(),
  };
}

export interface ListEnquiriesResult {
  data: EnquiryResponse[];
  meta: { page: number; pageSize: number; total: number };
}

export async function listEnquiries(ctx: RequestContext, query: ListEnquiriesQuery): Promise<ListEnquiriesResult> {
  const where: Prisma.WebsiteSubmissionWhereInput = {
    ...scoped(ctx),
    archivedAt: query.archived ? { not: null } : null,
    ...(query.status ? { status: query.status } : {}),
    ...(query.formType ? { formType: query.formType } : {}),
    ...(query.receivedFrom || query.receivedTo
      ? {
          receivedAt: {
            ...(query.receivedFrom ? { gte: new Date(query.receivedFrom) } : {}),
            ...(query.receivedTo ? { lte: new Date(query.receivedTo) } : {}),
          },
        }
      : {}),
  };

  const orderBy = buildOrderBy(query.sort, { field: 'receivedAt', direction: 'desc' });

  const [rows, total] = await Promise.all([
    prisma.websiteSubmission.findMany({ where, orderBy, ...toSkipTake(query) }),
    prisma.websiteSubmission.count({ where }),
  ]);

  return { data: rows.map(toEnquiryResponse), meta: buildPaginationMeta(query, total) };
}

export async function getEnquiry(ctx: RequestContext, id: string): Promise<EnquiryDetailResponse['data']> {
  const submission = await prisma.websiteSubmission.findFirst({ where: { id, ...scoped(ctx) } });
  if (!submission) {
    throw new ApiError(404, 'NOT_FOUND', 'Enquiry not found');
  }

  const leadRow = submission.leadId ? await prisma.lead.findUnique({ where: { id: submission.leadId } }) : null;

  return {
    ...toEnquiryResponse(submission),
    payload: submission.payload,
    lead: leadRow
      ? {
          id: leadRow.id,
          firstName: leadRow.firstName,
          lastName: leadRow.lastName,
          email: leadRow.email,
          phone: leadRow.phone,
          companyName: leadRow.companyName,
          status: leadRow.status,
          archivedAt: leadRow.archivedAt ? leadRow.archivedAt.toISOString() : null,
        }
      : null,
  };
}

/**
 * A human, after-the-fact "this was spam" call — distinct from the intake
 * endpoint's own automatic honeypot handling (which already stores a hit as
 * SPAM at submission time and never reaches here). Also archives the linked
 * Lead, if one exists, in the same transaction (an already-archived linked
 * Lead is left alone, not re-archived or treated as an error).
 */
export async function markEnquirySpam(ctx: RequestContext, id: string): Promise<EnquiryResponse> {
  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.websiteSubmission.findFirst({ where: { id, ...scoped(ctx) } });
    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', 'Enquiry not found');
    }
    if (existing.status === 'SPAM') {
      throw new ApiError(409, 'ALREADY_SPAM', 'This enquiry is already marked as spam.');
    }

    const submission = await tx.websiteSubmission.update({ where: { id: existing.id }, data: { status: 'SPAM' } });

    if (submission.leadId) {
      const lead = await tx.lead.findFirst({ where: { id: submission.leadId, organizationId: ctx.orgId } });
      if (lead && !lead.archivedAt) {
        await tx.lead.update({ where: { id: lead.id }, data: { archivedAt: new Date() } });
        await writeAudit(tx, ctx, {
          action: 'lead.archived',
          entityType: 'lead',
          entityId: lead.id,
          metadata: { reason: 'linked enquiry marked as spam' },
        });
      }
    }

    await writeAudit(tx, ctx, { action: 'enquiry.marked_spam', entityType: 'websiteSubmission', entityId: submission.id });
    return submission;
  });
  return toEnquiryResponse(updated);
}

export async function archiveEnquiry(ctx: RequestContext, id: string): Promise<EnquiryResponse> {
  const archived = await prisma.$transaction(async (tx) => {
    const existing = await tx.websiteSubmission.findFirst({ where: { id, ...scoped(ctx) } });
    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', 'Enquiry not found');
    }
    if (existing.archivedAt) {
      throw new ApiError(409, 'ALREADY_ARCHIVED', 'This enquiry is already archived.');
    }
    const submission = await tx.websiteSubmission.update({
      where: { id: existing.id },
      data: { archivedAt: new Date() },
    });
    await writeAudit(tx, ctx, { action: 'enquiry.archived', entityType: 'websiteSubmission', entityId: submission.id });
    return submission;
  });
  return toEnquiryResponse(archived);
}

export async function restoreEnquiry(ctx: RequestContext, id: string): Promise<EnquiryResponse> {
  const restored = await prisma.$transaction(async (tx) => {
    const existing = await tx.websiteSubmission.findFirst({ where: { id, ...scoped(ctx) } });
    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', 'Enquiry not found');
    }
    if (!existing.archivedAt) {
      throw new ApiError(409, 'NOT_ARCHIVED', 'This enquiry is not archived.');
    }
    const submission = await tx.websiteSubmission.update({ where: { id: existing.id }, data: { archivedAt: null } });
    await writeAudit(tx, ctx, { action: 'enquiry.restored', entityType: 'websiteSubmission', entityId: submission.id });
    return submission;
  });
  return toEnquiryResponse(restored);
}
