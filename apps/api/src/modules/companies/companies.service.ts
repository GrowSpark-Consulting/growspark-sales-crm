import { normalizeCompanyName } from '@growspark/shared';
import type {
  CreateCompanyInput,
  UpdateCompanyInput,
  ListCompaniesQuery,
  CompanyResponse,
  DuplicateMatch,
} from '@growspark/shared';
import { prisma } from '../../db/prisma.js';
import { ApiError } from '../../middleware/error-handler.js';
import { scoped } from '../../lib/scoped.js';
import { writeAudit } from '../../lib/audit.js';
import { toSkipTake, buildPaginationMeta } from '../../lib/pagination.js';
import { buildOrderBy } from '../../lib/list-query.js';
import { findDuplicateCompanies } from '../../lib/duplicates.js';
import type { RequestContext } from '../../lib/context.js';
import type { Company, Prisma } from '../../generated/prisma/client.js';

function toCompanyResponse(company: Company): CompanyResponse {
  return {
    id: company.id,
    name: company.name,
    legalName: company.legalName,
    industry: company.industry,
    website: company.website,
    email: company.email,
    phone: company.phone,
    employeeSize: company.employeeSize,
    annualRevenue: company.annualRevenue ? company.annualRevenue.toString() : null,
    addressLine1: company.addressLine1,
    addressLine2: company.addressLine2,
    city: company.city,
    state: company.state,
    postalCode: company.postalCode,
    country: company.country,
    ownerId: company.ownerId,
    description: company.description,
    archivedAt: company.archivedAt ? company.archivedAt.toISOString() : null,
    createdAt: company.createdAt.toISOString(),
    updatedAt: company.updatedAt.toISOString(),
  };
}

// Only called at a call site that already checked `input.field !== undefined`
// (so it only ever needs to decide between "keep the text" and "clear it"),
// kept on a plain `string`, not `string | undefined` — with
// exactOptionalPropertyTypes on, a return type that included `undefined`
// would make the Prisma update's optional property type `string | null |
// undefined`, which Prisma's generated input types reject (undefined there
// means something different from "not present").
function blankToNull(value: string): string | null {
  return value === '' ? null : value;
}

async function assertOwnerInOrg(
  tx: Prisma.TransactionClient,
  organizationId: string,
  ownerId: string | null | undefined,
): Promise<void> {
  if (!ownerId) return;
  const owner = await tx.user.findFirst({ where: { id: ownerId, organizationId } });
  if (!owner) {
    throw new ApiError(404, 'NOT_FOUND', 'Owner not found');
  }
}

export interface ListCompaniesResult {
  data: CompanyResponse[];
  meta: { page: number; pageSize: number; total: number };
}

export async function listCompanies(
  ctx: RequestContext,
  query: ListCompaniesQuery,
): Promise<ListCompaniesResult> {
  const where: Prisma.CompanyWhereInput = {
    ...scoped(ctx),
    archivedAt: query.archived ? { not: null } : null,
    ...(query.ownerId ? { ownerId: query.ownerId } : {}),
    ...(query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: 'insensitive' } },
            { email: { contains: query.q, mode: 'insensitive' } },
            { phone: { contains: query.q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const orderBy = buildOrderBy(query.sort, { field: 'createdAt', direction: 'desc' });

  const [rows, total] = await Promise.all([
    prisma.company.findMany({ where, orderBy, ...toSkipTake(query) }),
    prisma.company.count({ where }),
  ]);

  return { data: rows.map(toCompanyResponse), meta: buildPaginationMeta(query, total) };
}

export interface CompanyMutationResult {
  company: CompanyResponse;
  duplicates: DuplicateMatch[];
}

export async function createCompany(
  ctx: RequestContext,
  input: CreateCompanyInput,
): Promise<CompanyMutationResult> {
  const nameNormalized = normalizeCompanyName(input.name)!;

  const created = await prisma.$transaction(async (tx) => {
    await assertOwnerInOrg(tx, ctx.orgId, input.ownerId);

    const company = await tx.company.create({
      data: {
        organizationId: ctx.orgId,
        name: input.name,
        nameNormalized,
        legalName: input.legalName ?? null,
        industry: input.industry ?? null,
        website: input.website ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        employeeSize: input.employeeSize ?? null,
        annualRevenue: input.annualRevenue ?? null,
        addressLine1: input.addressLine1 ?? null,
        addressLine2: input.addressLine2 ?? null,
        city: input.city ?? null,
        state: input.state ?? null,
        postalCode: input.postalCode ?? null,
        country: input.country ?? null,
        ownerId: input.ownerId ?? null,
        description: input.description ?? null,
      },
    });
    await writeAudit(tx, ctx, {
      action: 'company.created',
      entityType: 'company',
      entityId: company.id,
      metadata: { name: company.name },
    });
    return company;
  });

  const duplicates = await findDuplicateCompanies(ctx, nameNormalized, { excludeId: created.id });
  return { company: toCompanyResponse(created), duplicates };
}

export async function getCompany(ctx: RequestContext, id: string): Promise<CompanyResponse> {
  const company = await prisma.company.findFirst({ where: { id, ...scoped(ctx) } });
  if (!company) {
    throw new ApiError(404, 'NOT_FOUND', 'Company not found');
  }
  return toCompanyResponse(company);
}

export async function updateCompany(
  ctx: RequestContext,
  id: string,
  input: UpdateCompanyInput,
): Promise<CompanyMutationResult> {
  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.company.findFirst({ where: { id, ...scoped(ctx) } });
    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', 'Company not found');
    }

    await assertOwnerInOrg(tx, ctx.orgId, input.ownerId);

    const data: Prisma.CompanyUpdateInput = {
      ...(input.name !== undefined ? { name: input.name, nameNormalized: normalizeCompanyName(input.name)! } : {}),
      ...(input.legalName !== undefined ? { legalName: blankToNull(input.legalName) } : {}),
      ...(input.industry !== undefined ? { industry: blankToNull(input.industry) } : {}),
      ...(input.website !== undefined ? { website: blankToNull(input.website) } : {}),
      ...(input.email !== undefined ? { email: blankToNull(input.email) } : {}),
      ...(input.phone !== undefined ? { phone: blankToNull(input.phone) } : {}),
      ...(input.employeeSize !== undefined ? { employeeSize: blankToNull(input.employeeSize) } : {}),
      ...(input.annualRevenue !== undefined ? { annualRevenue: input.annualRevenue } : {}),
      ...(input.addressLine1 !== undefined ? { addressLine1: blankToNull(input.addressLine1) } : {}),
      ...(input.addressLine2 !== undefined ? { addressLine2: blankToNull(input.addressLine2) } : {}),
      ...(input.city !== undefined ? { city: blankToNull(input.city) } : {}),
      ...(input.state !== undefined ? { state: blankToNull(input.state) } : {}),
      ...(input.postalCode !== undefined ? { postalCode: blankToNull(input.postalCode) } : {}),
      ...(input.country !== undefined ? { country: blankToNull(input.country) } : {}),
      ...(input.ownerId !== undefined ? { ownerId: input.ownerId || null } : {}),
      ...(input.description !== undefined ? { description: blankToNull(input.description) } : {}),
    };

    const company = await tx.company.update({ where: { id: existing.id }, data });
    await writeAudit(tx, ctx, {
      action: 'company.updated',
      entityType: 'company',
      entityId: company.id,
      metadata: { changedFields: Object.keys(input) },
    });
    return company;
  });

  const duplicates =
    input.name !== undefined
      ? await findDuplicateCompanies(ctx, normalizeCompanyName(updated.name), { excludeId: updated.id })
      : [];
  return { company: toCompanyResponse(updated), duplicates };
}

export async function archiveCompany(ctx: RequestContext, id: string): Promise<CompanyResponse> {
  const archived = await prisma.$transaction(async (tx) => {
    const existing = await tx.company.findFirst({ where: { id, ...scoped(ctx) } });
    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', 'Company not found');
    }
    if (existing.archivedAt) {
      throw new ApiError(409, 'ALREADY_ARCHIVED', 'This company is already archived.');
    }
    const company = await tx.company.update({ where: { id: existing.id }, data: { archivedAt: new Date() } });
    await writeAudit(tx, ctx, { action: 'company.archived', entityType: 'company', entityId: company.id });
    return company;
  });
  return toCompanyResponse(archived);
}

export async function restoreCompany(ctx: RequestContext, id: string): Promise<CompanyResponse> {
  const restored = await prisma.$transaction(async (tx) => {
    const existing = await tx.company.findFirst({ where: { id, ...scoped(ctx) } });
    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', 'Company not found');
    }
    if (!existing.archivedAt) {
      throw new ApiError(409, 'NOT_ARCHIVED', 'This company is not archived.');
    }
    const company = await tx.company.update({ where: { id: existing.id }, data: { archivedAt: null } });
    await writeAudit(tx, ctx, { action: 'company.restored', entityType: 'company', entityId: company.id });
    return company;
  });
  return toCompanyResponse(restored);
}
