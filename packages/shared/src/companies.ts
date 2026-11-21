import { z } from 'zod';
import { pageQuerySchema, paginationMetaSchema, sortQuerySchema, booleanQueryParam } from './common.js';
import { duplicateMatchSchema } from './duplicates.js';
import { phoneFieldSchema } from './phone.js';

function optionalTrimmed(max: number) {
  return z.string().trim().max(max).optional();
}

export const createCompanySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(300, 'Name is too long'),
  legalName: optionalTrimmed(300),
  industry: optionalTrimmed(200),
  website: optionalTrimmed(2000),
  email: z.string().trim().max(320, 'Email is too long').optional(),
  // D41: country-code-select + number composed client-side into a single
  // canonical E.164 string; validated strictly here for manual CRM entry.
  phone: phoneFieldSchema.optional(),
  employeeSize: optionalTrimmed(100),
  annualRevenue: z.union([z.number().nonnegative('Annual revenue cannot be negative'), z.string().regex(/^\d+(\.\d{1,2})?$/, 'Enter a valid amount')]).optional(),
  addressLine1: optionalTrimmed(300),
  addressLine2: optionalTrimmed(300),
  city: optionalTrimmed(150),
  state: optionalTrimmed(150),
  postalCode: optionalTrimmed(30),
  country: optionalTrimmed(150),
  ownerId: z.uuid().nullable().optional(),
  description: z.string().trim().max(5000, 'Description is too long').optional(),
});
export type CreateCompanyInput = z.infer<typeof createCompanySchema>;

export const updateCompanySchema = createCompanySchema.partial();
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;

const COMPANY_SORT_FIELDS = ['name', 'createdAt', 'updatedAt'] as const;

export const listCompaniesQuerySchema = pageQuerySchema.extend({
  sort: sortQuerySchema(COMPANY_SORT_FIELDS),
  q: z.string().trim().min(1).optional(),
  archived: booleanQueryParam.optional(),
  ownerId: z.uuid().optional(),
});
export type ListCompaniesQuery = z.infer<typeof listCompaniesQuerySchema>;

export const companyResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  legalName: z.string().nullable(),
  industry: z.string().nullable(),
  website: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  employeeSize: z.string().nullable(),
  annualRevenue: z.string().nullable(),
  addressLine1: z.string().nullable(),
  addressLine2: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  postalCode: z.string().nullable(),
  country: z.string().nullable(),
  ownerId: z.string().nullable(),
  description: z.string().nullable(),
  archivedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type CompanyResponse = z.infer<typeof companyResponseSchema>;

export const companiesListResponseSchema = z.object({
  data: z.array(companyResponseSchema),
  meta: paginationMetaSchema,
});

/** Create/update response: D29 duplicates warn, so they ride alongside `data`, never replacing it. */
export const companyWithDuplicatesResponseSchema = z.object({
  data: companyResponseSchema,
  duplicates: z.array(duplicateMatchSchema),
});
