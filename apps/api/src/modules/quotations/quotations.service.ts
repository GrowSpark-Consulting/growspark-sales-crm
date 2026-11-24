import {
  DEFAULT_QUOTATION_TAX_PERCENT,
  DEFAULT_QUOTATION_VALIDITY_DAYS,
  QUOTATION_STATUS_TRANSITIONS,
  type CalculateQuotationInput,
  type ChangeQuotationStatusInput,
  type CreateQuotationInput,
  type ListQuotationsQuery,
  type QuotationLineItemResponse,
  type QuotationResponse,
  type QuotationStatus,
  type QuotationTotals,
  type UpdateQuotationInput,
} from '@growspark/shared';
import { prisma } from '../../db/prisma.js';
import { Prisma } from '../../generated/prisma/client.js';
import { ApiError } from '../../middleware/error-handler.js';
import { scoped } from '../../lib/scoped.js';
import { writeAudit } from '../../lib/audit.js';
import { toSkipTake, buildPaginationMeta } from '../../lib/pagination.js';
import { buildOrderBy } from '../../lib/list-query.js';
import { orgDateKey } from '../../lib/org-time.js';
import { calculateQuotationTotals, toMoneyString, type MoneyLineInput } from '../../lib/quotation-money.js';
import { allocateQuotationNumber } from '../../lib/quotation-number.js';
import { logger } from '../../logger.js';
import type { RequestContext } from '../../lib/context.js';
import type { Quotation, QuotationLineItem } from '../../generated/prisma/client.js';

const summaryInclude = {
  company: { select: { name: true } },
  contact: { select: { firstName: true, lastName: true } },
  deal: { select: { name: true } },
  owner: { select: { name: true } },
} satisfies Prisma.QuotationInclude;

const detailInclude = {
  ...summaryInclude,
  lineItems: { orderBy: { position: 'asc' } },
} satisfies Prisma.QuotationInclude;

type QuotationWithSummary = Quotation & {
  company: { name: string };
  contact: { firstName: string; lastName: string | null };
  deal: { name: string } | null;
  owner: { name: string } | null;
  lineItems?: QuotationLineItem[];
};

/** A @db.Date column comes back as UTC midnight; its ISO date is the stored calendar date. */
function dateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function dateFromKey(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

function addDaysToKey(key: string, days: number): string {
  const date = dateFromKey(key);
  date.setUTCDate(date.getUTCDate() + days);
  return dateKey(date);
}

/**
 * D86: a SENT quotation whose valid-until date is before the organisation's
 * current calendar date reads as EXPIRED everywhere — detail, list rows, the
 * list's Status filter and the PDF — whether or not the stored row has been
 * flipped yet. A quotation is still valid on its valid-until date itself.
 */
export function effectiveQuotationStatus(status: QuotationStatus, validUntil: Date, todayKey: string): QuotationStatus {
  return status === 'SENT' && dateKey(validUntil) < todayKey ? 'EXPIRED' : status;
}

export function quotationPdfReference(quotation: Pick<Quotation, 'number' | 'version'>): string {
  return `${quotation.number}-v${quotation.version}`;
}

function toLineItemResponse(item: QuotationLineItem): QuotationLineItemResponse {
  return {
    id: item.id,
    position: item.position,
    description: item.description,
    quantity: item.quantity.toFixed(2),
    unitPrice: toMoneyString(item.unitPrice),
    discountPercent: item.discountPercent.toFixed(2),
    lineTotal: toMoneyString(item.lineTotal),
  };
}

function toQuotationResponse(quotation: QuotationWithSummary, todayKey: string): QuotationResponse {
  return {
    id: quotation.id,
    number: quotation.number,
    version: quotation.version,
    pdfReference: quotationPdfReference(quotation),
    companyId: quotation.companyId,
    companyName: quotation.company.name,
    contactId: quotation.contactId,
    contactName: [quotation.contact.firstName, quotation.contact.lastName].filter(Boolean).join(' '),
    dealId: quotation.dealId,
    dealName: quotation.deal?.name ?? null,
    ownerId: quotation.ownerId,
    ownerName: quotation.owner?.name ?? null,
    status: effectiveQuotationStatus(quotation.status, quotation.validUntil, todayKey),
    issueDate: dateKey(quotation.issueDate),
    validUntil: dateKey(quotation.validUntil),
    currency: quotation.currency,
    discountPercent: quotation.discountPercent.toFixed(2),
    taxPercent: quotation.taxPercent.toFixed(2),
    subtotal: toMoneyString(quotation.subtotal),
    discountAmount: toMoneyString(quotation.discountAmount),
    taxableAmount: quotation.subtotal.minus(quotation.discountAmount).toFixed(2),
    taxAmount: toMoneyString(quotation.taxAmount),
    total: toMoneyString(quotation.total),
    terms: quotation.terms,
    notes: quotation.notes,
    sentAt: quotation.sentAt ? quotation.sentAt.toISOString() : null,
    archivedAt: quotation.archivedAt ? quotation.archivedAt.toISOString() : null,
    createdAt: quotation.createdAt.toISOString(),
    updatedAt: quotation.updatedAt.toISOString(),
    ...(quotation.lineItems ? { lineItems: quotation.lineItems.map(toLineItemResponse) } : {}),
  };
}

async function organizationToday(orgId: string, now: Date): Promise<string> {
  const organization = await prisma.organization.findUnique({ where: { id: orgId }, select: { timezone: true } });
  if (!organization) throw new ApiError(404, 'NOT_FOUND', 'Organisation not found');
  return orgDateKey(now, organization.timezone);
}

/**
 * D86: persists the SENT -> EXPIRED flip for every lapsed quotation in the
 * organisation, audited as a system action (actorId null). Best-effort by
 * design: it runs before a read, and any failure is logged and swallowed so
 * the read itself always succeeds — correctness of what the reader sees never
 * depends on this write, because every response and the Status filter already
 * use the effective status. The conditional `status = 'SENT'` in the UPDATE
 * means two concurrent reads can never both flip (or both audit) the same row.
 */
export async function expireLapsedQuotations(orgId: string, todayKey: string): Promise<number> {
  try {
    return await prisma.$transaction(async (tx) => {
      const expired = await tx.quotation.updateManyAndReturn({
        where: { organizationId: orgId, status: 'SENT', validUntil: { lt: dateFromKey(todayKey) } },
        data: { status: 'EXPIRED' },
        select: { id: true, number: true },
      });
      if (expired.length > 0) {
        await tx.auditEvent.createMany({
          data: expired.map((quotation) => ({
            organizationId: orgId,
            actorId: null,
            action: 'quotation.expired',
            entityType: 'quotation',
            entityId: quotation.id,
            metadata: { number: quotation.number, fromStatus: 'SENT', toStatus: 'EXPIRED' },
          })),
        });
      }
      return expired.length;
    });
  } catch (err) {
    logger.warn({ err, orgId }, 'quotation auto-expiry failed; the read continues with computed statuses');
    return 0;
  }
}

/** Shared by listQuotations and the Reports module later, so a Status filter can never disagree with the detail page. */
export function quotationStatusWhere(status: QuotationStatus, todayKey: string): Prisma.QuotationWhereInput {
  const today = dateFromKey(todayKey);
  if (status === 'SENT') return { status: 'SENT', validUntil: { gte: today } };
  if (status === 'EXPIRED') return { OR: [{ status: 'EXPIRED' }, { status: 'SENT', validUntil: { lt: today } }] };
  return { status };
}

function buildQuotationsWhere(ctx: RequestContext, query: ListQuotationsQuery, todayKey: string): Prisma.QuotationWhereInput {
  const and: Prisma.QuotationWhereInput[] = [];
  if (query.status) and.push(quotationStatusWhere(query.status, todayKey));
  if (query.q) {
    and.push({
      OR: [
        { number: { contains: query.q, mode: 'insensitive' } },
        { company: { name: { contains: query.q, mode: 'insensitive' } } },
      ],
    });
  }
  return {
    ...scoped(ctx),
    archivedAt: query.archived ? { not: null } : null,
    ...(query.companyId ? { companyId: query.companyId } : {}),
    ...(query.contactId ? { contactId: query.contactId } : {}),
    ...(query.dealId ? { dealId: query.dealId } : {}),
    ...(query.ownerId ? { ownerId: query.ownerId } : {}),
    ...(query.issuedFrom || query.issuedTo
      ? {
          issueDate: {
            ...(query.issuedFrom ? { gte: dateFromKey(query.issuedFrom) } : {}),
            ...(query.issuedTo ? { lte: dateFromKey(query.issuedTo) } : {}),
          },
        }
      : {}),
    ...(and.length > 0 ? { AND: and } : {}),
  };
}

export interface ListQuotationsResult {
  data: QuotationResponse[];
  meta: { page: number; pageSize: number; total: number };
}

export async function listQuotations(ctx: RequestContext, query: ListQuotationsQuery, now = new Date()): Promise<ListQuotationsResult> {
  const todayKey = await organizationToday(ctx.orgId, now);
  await expireLapsedQuotations(ctx.orgId, todayKey);
  const where = buildQuotationsWhere(ctx, query, todayKey);
  const orderBy = buildOrderBy(query.sort, { field: 'createdAt', direction: 'desc' });
  const [rows, total] = await Promise.all([
    prisma.quotation.findMany({ where, orderBy, ...toSkipTake(query), include: summaryInclude }),
    prisma.quotation.count({ where }),
  ]);
  return { data: rows.map((row) => toQuotationResponse(row, todayKey)), meta: buildPaginationMeta(query, total) };
}

export async function getQuotation(ctx: RequestContext, id: string, now = new Date()): Promise<QuotationResponse> {
  const todayKey = await organizationToday(ctx.orgId, now);
  await expireLapsedQuotations(ctx.orgId, todayKey);
  const quotation = await prisma.quotation.findFirst({ where: { id, ...scoped(ctx) }, include: detailInclude });
  if (!quotation) throw new ApiError(404, 'NOT_FOUND', 'Quotation not found');
  return toQuotationResponse(quotation, todayKey);
}

/**
 * Reads the finished quotation after its transaction has committed. Not done
 * inside the transaction on purpose: a multi-relation include makes Prisma
 * issue its relation queries concurrently, which on a transaction's single
 * pg connection triggers pg@8's "client already executing a query"
 * deprecation (a hard error in pg@9) — see D85.
 */
async function loadQuotationResponse(id: string, todayKey: string): Promise<QuotationResponse> {
  const quotation = await prisma.quotation.findUniqueOrThrow({ where: { id }, include: detailInclude });
  return toQuotationResponse(quotation, todayKey);
}

interface Relations {
  companyId: string;
  contactId: string;
  dealId: string | null;
  ownerId: string | null;
}

async function assertRelations(tx: Prisma.TransactionClient, orgId: string, relations: Relations): Promise<void> {
  const company = await tx.company.findFirst({ where: { id: relations.companyId, organizationId: orgId } });
  if (!company) throw new ApiError(404, 'NOT_FOUND', 'Company not found');

  const contact = await tx.contact.findFirst({ where: { id: relations.contactId, organizationId: orgId } });
  if (!contact) throw new ApiError(404, 'NOT_FOUND', 'Contact not found');
  if (contact.companyId && contact.companyId !== relations.companyId) {
    throw new ApiError(422, 'VALIDATION_FAILED', 'This contact belongs to a different company.', [
      { path: 'contactId', message: 'Pick a contact from the selected company' },
    ]);
  }

  if (relations.dealId) {
    const deal = await tx.deal.findFirst({ where: { id: relations.dealId, organizationId: orgId } });
    if (!deal) throw new ApiError(404, 'NOT_FOUND', 'Deal not found');
    if (deal.companyId !== relations.companyId) {
      throw new ApiError(422, 'VALIDATION_FAILED', 'This deal belongs to a different company.', [
        { path: 'dealId', message: 'Pick a deal for the selected company' },
      ]);
    }
  }

  if (relations.ownerId) {
    const owner = await tx.user.findFirst({ where: { id: relations.ownerId, organizationId: orgId } });
    if (!owner) throw new ApiError(404, 'NOT_FOUND', 'Owner not found');
  }
}

function assertDates(issueDate: string, validUntil: string): void {
  if (validUntil < issueDate) {
    throw new ApiError(422, 'VALIDATION_FAILED', 'Valid until cannot be before the issue date', [
      { path: 'validUntil', message: 'Valid until cannot be before the issue date' },
    ]);
  }
}

function lineItemRows(orgId: string, quotationId: string, lines: readonly (MoneyLineInput & { description: string })[], lineTotals: string[]) {
  return lines.map((line, index) => ({
    organizationId: orgId,
    quotationId,
    position: index + 1,
    description: line.description,
    quantity: new Prisma.Decimal(line.quantity),
    unitPrice: new Prisma.Decimal(line.unitPrice),
    discountPercent: new Prisma.Decimal(line.discountPercent ?? '0'),
    lineTotal: new Prisma.Decimal(lineTotals[index]!),
  }));
}

function totalsData(totals: ReturnType<typeof calculateQuotationTotals>) {
  return {
    subtotal: new Prisma.Decimal(totals.subtotal),
    discountAmount: new Prisma.Decimal(totals.discountAmount),
    taxAmount: new Prisma.Decimal(totals.taxAmount),
    total: new Prisma.Decimal(totals.total),
  };
}

export function calculateTotals(input: CalculateQuotationInput): QuotationTotals {
  return calculateQuotationTotals(input.lineItems, input.discountPercent ?? '0', input.taxPercent ?? DEFAULT_QUOTATION_TAX_PERCENT);
}

export async function createQuotation(ctx: RequestContext, input: CreateQuotationInput, now = new Date()): Promise<QuotationResponse> {
  const todayKey = await organizationToday(ctx.orgId, now);
  const issueDate = input.issueDate ?? todayKey;
  const validUntil = input.validUntil ?? addDaysToKey(issueDate, DEFAULT_QUOTATION_VALIDITY_DAYS);
  assertDates(issueDate, validUntil);
  const discountPercent = input.discountPercent ?? '0';
  const taxPercent = input.taxPercent ?? DEFAULT_QUOTATION_TAX_PERCENT;
  const totals = calculateQuotationTotals(input.lineItems, discountPercent, taxPercent);

  const createdId = await prisma.$transaction(async (tx) => {
    const relations: Relations = {
      companyId: input.companyId,
      contactId: input.contactId,
      dealId: input.dealId ?? null,
      ownerId: input.ownerId === undefined ? ctx.userId : input.ownerId,
    };
    await assertRelations(tx, ctx.orgId, relations);
    const number = await allocateQuotationNumber(tx, ctx.orgId, Number(todayKey.slice(0, 4)));
    const quotation = await tx.quotation.create({
      data: {
        organizationId: ctx.orgId,
        number,
        ...relations,
        issueDate: dateFromKey(issueDate),
        validUntil: dateFromKey(validUntil),
        discountPercent: new Prisma.Decimal(discountPercent),
        taxPercent: new Prisma.Decimal(taxPercent),
        ...totalsData(totals),
        terms: input.terms || null,
        notes: input.notes || null,
      },
    });
    await tx.quotationLineItem.createMany({ data: lineItemRows(ctx.orgId, quotation.id, input.lineItems, totals.lineTotals) });
    await writeAudit(tx, ctx, {
      action: 'quotation.created',
      entityType: 'quotation',
      entityId: quotation.id,
      metadata: { number, companyId: relations.companyId, contactId: relations.contactId, dealId: relations.dealId, total: totals.total },
    });
    return quotation.id;
  });
  return loadQuotationResponse(createdId, todayKey);
}

export async function updateQuotation(ctx: RequestContext, id: string, input: UpdateQuotationInput, now = new Date()): Promise<QuotationResponse> {
  const todayKey = await organizationToday(ctx.orgId, now);
  const updatedId = await prisma.$transaction(async (tx) => {
    const existing = await tx.quotation.findFirst({ where: { id, ...scoped(ctx) }, include: { lineItems: { orderBy: { position: 'asc' } } } });
    if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Quotation not found');
    if (existing.status !== 'DRAFT') {
      throw new ApiError(409, 'CONFLICT', 'Only a draft quotation can be edited — duplicate it to make changes.');
    }

    const relations: Relations = {
      companyId: input.companyId ?? existing.companyId,
      contactId: input.contactId ?? existing.contactId,
      dealId: input.dealId === undefined ? existing.dealId : input.dealId,
      ownerId: input.ownerId === undefined ? existing.ownerId : input.ownerId,
    };
    await assertRelations(tx, ctx.orgId, relations);

    const issueDate = input.issueDate ?? dateKey(existing.issueDate);
    const validUntil = input.validUntil ?? dateKey(existing.validUntil);
    assertDates(issueDate, validUntil);

    const lines = input.lineItems ?? existing.lineItems.map((item) => ({
      description: item.description,
      quantity: item.quantity.toFixed(2),
      unitPrice: item.unitPrice.toFixed(2),
      discountPercent: item.discountPercent.toFixed(2),
    }));
    const discountPercent = input.discountPercent ?? existing.discountPercent.toFixed(2);
    const taxPercent = input.taxPercent ?? existing.taxPercent.toFixed(2);
    const totals = calculateQuotationTotals(lines, discountPercent, taxPercent);

    // Conditional on the status read above, so a concurrent "mark as sent"
    // can't slip in between this check and the write.
    const { count } = await tx.quotation.updateMany({
      where: { id: existing.id, status: 'DRAFT' },
      data: {
        ...relations,
        issueDate: dateFromKey(issueDate),
        validUntil: dateFromKey(validUntil),
        discountPercent: new Prisma.Decimal(discountPercent),
        taxPercent: new Prisma.Decimal(taxPercent),
        ...totalsData(totals),
        ...(input.terms !== undefined ? { terms: input.terms || null } : {}),
        ...(input.notes !== undefined ? { notes: input.notes || null } : {}),
        version: { increment: 1 },
      },
    });
    if (count === 0) throw new ApiError(409, 'CONFLICT', 'This quotation changed while you were editing it. Reload and try again.');

    await tx.quotationLineItem.deleteMany({ where: { quotationId: existing.id } });
    await tx.quotationLineItem.createMany({ data: lineItemRows(ctx.orgId, existing.id, lines, totals.lineTotals) });
    await writeAudit(tx, ctx, {
      action: 'quotation.updated',
      entityType: 'quotation',
      entityId: existing.id,
      metadata: { number: existing.number, version: existing.version + 1, changedFields: Object.keys(input), total: totals.total },
    });
    return existing.id;
  });
  return loadQuotationResponse(updatedId, todayKey);
}

export interface StatusChangeResult {
  quotation: QuotationResponse;
  fromStatus: QuotationStatus;
}

export async function changeQuotationStatus(
  ctx: RequestContext,
  id: string,
  input: ChangeQuotationStatusInput,
  now = new Date(),
): Promise<StatusChangeResult> {
  const todayKey = await organizationToday(ctx.orgId, now);
  await expireLapsedQuotations(ctx.orgId, todayKey);
  const { quotationId, fromStatus } = await prisma.$transaction(async (tx) => {
    const existing = await tx.quotation.findFirst({ where: { id, ...scoped(ctx) } });
    if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Quotation not found');
    if (existing.archivedAt) throw new ApiError(409, 'CONFLICT', 'Restore this quotation before changing its status.');

    const current = effectiveQuotationStatus(existing.status, existing.validUntil, todayKey);
    if (!QUOTATION_STATUS_TRANSITIONS[current].includes(input.status)) {
      const reason = current === 'EXPIRED'
        ? `This quotation expired on ${dateKey(existing.validUntil)} — duplicate it to re-quote.`
        : `A ${current.toLowerCase()} quotation cannot be marked ${input.status.toLowerCase()}.`;
      throw new ApiError(409, 'INVALID_STATUS_TRANSITION', reason);
    }
    // D88: sending a quotation that is already out of date would only make it
    // read as Expired at once — refuse, so the user fixes the date first.
    if (input.status === 'SENT' && dateKey(existing.validUntil) < todayKey) {
      throw new ApiError(409, 'VALID_UNTIL_PASSED', 'Valid-until date has passed, change it first.');
    }

    const { count } = await tx.quotation.updateMany({
      where: { id: existing.id, status: existing.status },
      data: { status: input.status, ...(input.status === 'SENT' ? { sentAt: now } : {}) },
    });
    if (count === 0) throw new ApiError(409, 'CONFLICT', 'This quotation changed at the same time. Reload and try again.');

    await writeAudit(tx, ctx, {
      action: 'quotation.status_changed',
      entityType: 'quotation',
      entityId: existing.id,
      metadata: { number: existing.number, fromStatus: current, toStatus: input.status },
    });
    return { quotationId: existing.id, fromStatus: current };
  });
  return { quotation: await loadQuotationResponse(quotationId, todayKey), fromStatus };
}

export async function duplicateQuotation(ctx: RequestContext, id: string, now = new Date()): Promise<QuotationResponse> {
  const todayKey = await organizationToday(ctx.orgId, now);
  const createdId = await prisma.$transaction(async (tx) => {
    const source = await tx.quotation.findFirst({ where: { id, ...scoped(ctx) }, include: { lineItems: { orderBy: { position: 'asc' } } } });
    if (!source) throw new ApiError(404, 'NOT_FOUND', 'Quotation not found');

    const number = await allocateQuotationNumber(tx, ctx.orgId, Number(todayKey.slice(0, 4)));
    const quotation = await tx.quotation.create({
      data: {
        organizationId: ctx.orgId,
        number,
        companyId: source.companyId,
        contactId: source.contactId,
        dealId: source.dealId,
        ownerId: ctx.userId,
        issueDate: dateFromKey(todayKey),
        validUntil: dateFromKey(addDaysToKey(todayKey, DEFAULT_QUOTATION_VALIDITY_DAYS)),
        currency: source.currency,
        discountPercent: source.discountPercent,
        taxPercent: source.taxPercent,
        subtotal: source.subtotal,
        discountAmount: source.discountAmount,
        taxAmount: source.taxAmount,
        total: source.total,
        terms: source.terms,
        notes: source.notes,
      },
    });
    await tx.quotationLineItem.createMany({
      data: source.lineItems.map((item) => ({
        organizationId: ctx.orgId,
        quotationId: quotation.id,
        position: item.position,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountPercent: item.discountPercent,
        lineTotal: item.lineTotal,
      })),
    });
    await writeAudit(tx, ctx, {
      action: 'quotation.duplicated',
      entityType: 'quotation',
      entityId: quotation.id,
      metadata: { number, duplicatedFromNumber: source.number, companyId: source.companyId, dealId: source.dealId },
    });
    return quotation.id;
  });
  return loadQuotationResponse(createdId, todayKey);
}

async function setArchived(ctx: RequestContext, id: string, archive: boolean, now: Date): Promise<QuotationResponse> {
  const todayKey = await organizationToday(ctx.orgId, now);
  const resultId = await prisma.$transaction(async (tx) => {
    const existing = await tx.quotation.findFirst({ where: { id, ...scoped(ctx) } });
    if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Quotation not found');
    if (archive && existing.archivedAt) throw new ApiError(409, 'ALREADY_ARCHIVED', 'This quotation is already archived.');
    if (!archive && !existing.archivedAt) throw new ApiError(409, 'NOT_ARCHIVED', 'This quotation is not archived.');
    await tx.quotation.update({ where: { id: existing.id }, data: { archivedAt: archive ? now : null } });
    await writeAudit(tx, ctx, {
      action: archive ? 'quotation.archived' : 'quotation.restored',
      entityType: 'quotation',
      entityId: existing.id,
      metadata: { number: existing.number },
    });
    return existing.id;
  });
  return loadQuotationResponse(resultId, todayKey);
}

export function archiveQuotation(ctx: RequestContext, id: string, now = new Date()): Promise<QuotationResponse> {
  return setArchived(ctx, id, true, now);
}

export function restoreQuotation(ctx: RequestContext, id: string, now = new Date()): Promise<QuotationResponse> {
  return setArchived(ctx, id, false, now);
}

/** Everything the PDF needs, read once: the quotation, the seller (organisation) and the buyer (company/contact). */
export async function getQuotationForPdf(ctx: RequestContext, id: string, now = new Date()) {
  const quotation = await getQuotation(ctx, id, now);
  const [organization, company, contact] = await Promise.all([
    prisma.organization.findUniqueOrThrow({ where: { id: ctx.orgId } }),
    prisma.company.findFirstOrThrow({ where: { id: quotation.companyId, ...scoped(ctx) } }),
    prisma.contact.findFirstOrThrow({ where: { id: quotation.contactId, ...scoped(ctx) } }),
  ]);
  return { quotation, organization, company, contact };
}
