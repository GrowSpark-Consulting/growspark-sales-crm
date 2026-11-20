import { z } from 'zod';
import { pageQuerySchema, paginationMetaSchema, sortQuerySchema, booleanQueryParam } from './common.js';
import { duplicateMatchSchema } from './duplicates.js';
import { phoneFieldSchema } from './phone.js';

function optionalTrimmed(max: number) {
  return z.string().trim().max(max).optional();
}

export const createContactSchema = z.object({
  companyId: z.uuid().nullable().optional(),
  firstName: z.string().trim().min(1, 'First name is required').max(200, 'First name is too long'),
  lastName: optionalTrimmed(200),
  email: z.string().trim().max(320, 'Email is too long').optional(),
  // D41: country-code-select + number composed client-side into a single
  // canonical E.164 string; validated strictly here for manual CRM entry.
  phone: phoneFieldSchema.optional(),
  jobTitle: optionalTrimmed(200),
  department: optionalTrimmed(200),
  location: optionalTrimmed(200),
  // Free text, not a fixed enum: the brief names this field but never
  // enumerates its values (unlike lead status/priority, which the schema
  // itself constrains with a real Postgres enum) — see docs/decisions.md.
  lifecycleStatus: optionalTrimmed(50),
  ownerId: z.uuid().nullable().optional(),
  notes: z.string().trim().max(5000, 'Notes are too long').optional(),
});
export type CreateContactInput = z.infer<typeof createContactSchema>;

export const updateContactSchema = createContactSchema.partial();
export type UpdateContactInput = z.infer<typeof updateContactSchema>;

const CONTACT_SORT_FIELDS = ['firstName', 'lastName', 'createdAt', 'updatedAt'] as const;

export const listContactsQuerySchema = pageQuerySchema.extend({
  sort: sortQuerySchema(CONTACT_SORT_FIELDS),
  q: z.string().trim().min(1).optional(),
  archived: booleanQueryParam.optional(),
  companyId: z.uuid().optional(),
  ownerId: z.uuid().optional(),
});
export type ListContactsQuery = z.infer<typeof listContactsQuerySchema>;

export const contactResponseSchema = z.object({
  id: z.string(),
  companyId: z.string().nullable(),
  firstName: z.string(),
  lastName: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  jobTitle: z.string().nullable(),
  department: z.string().nullable(),
  location: z.string().nullable(),
  lifecycleStatus: z.string(),
  ownerId: z.string().nullable(),
  notes: z.string().nullable(),
  archivedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ContactResponse = z.infer<typeof contactResponseSchema>;

export const contactsListResponseSchema = z.object({
  data: z.array(contactResponseSchema),
  meta: paginationMetaSchema,
});

/** Create/update response: D29 duplicates warn, so they ride alongside `data`, never replacing it. */
export const contactWithDuplicatesResponseSchema = z.object({
  data: contactResponseSchema,
  duplicates: z.array(duplicateMatchSchema),
});
