import { z } from 'zod';

/**
 * D7/Day 3 brief: company/contact are each either linked (an existing id) or
 * created (from the lead's own fields) — no separate "create" flag needed,
 * presence of the id is the signal. The deal is the only genuinely optional
 * piece (`createDeal`); `deal` is only read when `createDeal` is true.
 */
export const convertLeadSchema = z.object({
  companyId: z.uuid().optional(),
  contactId: z.uuid().optional(),
  createDeal: z.boolean().optional(),
  deal: z
    .object({
      name: z.string().trim().min(1, 'Deal name is required').max(300, 'Deal name is too long').optional(),
      value: z.coerce.number().nonnegative('Value cannot be negative').optional(),
      expectedCloseDate: z.iso.date().optional(),
      ownerId: z.uuid().nullable().optional(),
      dealType: z.string().trim().max(100).optional(),
    })
    .optional(),
});
export type ConvertLeadInput = z.infer<typeof convertLeadSchema>;

export const leadConversionResponseSchema = z.object({
  data: z.object({
    leadId: z.string(),
    companyId: z.string(),
    contactId: z.string(),
    dealId: z.string().nullable(),
    createdCompany: z.boolean(),
    createdContact: z.boolean(),
  }),
});
export type LeadConversionResponse = z.infer<typeof leadConversionResponseSchema>;

const leadConversionMatchCompanySchema = z.object({ id: z.string(), name: z.string() });
const leadConversionMatchContactSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string().nullable(),
  email: z.string().nullable(),
});

export const leadConversionMatchesResponseSchema = z.object({
  data: z.object({
    companies: z.array(leadConversionMatchCompanySchema),
    contacts: z.array(leadConversionMatchContactSchema),
  }),
});
export type LeadConversionMatchesResponse = z.infer<typeof leadConversionMatchesResponseSchema>;
