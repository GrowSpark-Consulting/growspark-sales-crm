import { z } from 'zod';

/** CSV import of leads and contacts (Day 6a, D95). */

export const IMPORT_ENTITIES = ['leads', 'contacts'] as const;
export const importEntitySchema = z.enum(IMPORT_ENTITIES);
export type ImportEntity = z.infer<typeof importEntitySchema>;

/** 1 MB of CSV text, measured as UTF-8 bytes. */
export const IMPORT_MAX_BYTES = 1024 * 1024;
export const IMPORT_MAX_ROWS = 1000;
export const IMPORT_MAX_COLUMNS = 50;

export interface ImportFieldDefinition {
  key: string;
  label: string;
  /** Lower-cased, punctuation-stripped header spellings that map here automatically. */
  aliases: readonly string[];
  /** Shown to the user while mapping; the real rules are enforced by the server. */
  hint?: string;
}

const NAME_FIELDS = [
  { key: 'firstName', label: 'First name', aliases: ['first name', 'firstname', 'first', 'given name', 'forename'] },
  { key: 'lastName', label: 'Last name', aliases: ['last name', 'lastname', 'last', 'surname', 'family name'] },
  {
    key: 'fullName',
    label: 'Full name (split at the first space)',
    aliases: ['name', 'full name', 'fullname', 'contact name', 'lead name', 'contact'],
    hint: 'Used only when First name is empty.',
  },
  { key: 'email', label: 'Email', aliases: ['email', 'e mail', 'email address', 'mail'] },
  {
    key: 'phone',
    label: 'Phone',
    aliases: ['phone', 'phone number', 'mobile', 'mobile number', 'telephone', 'tel', 'contact number'],
    hint: 'With a country code (+91 98400 12345); a bare 10-digit number is taken as India (+91).',
  },
] as const satisfies readonly ImportFieldDefinition[];

export const IMPORT_FIELDS = {
  leads: [
    ...NAME_FIELDS,
    {
      key: 'companyName',
      label: 'Company',
      aliases: ['company', 'company name', 'organisation', 'organization', 'account'],
      hint: 'Required on every row (D98).',
    },
    { key: 'jobTitle', label: 'Job title', aliases: ['job title', 'title', 'designation', 'role', 'position'] },
    { key: 'industry', label: 'Industry', aliases: ['industry', 'sector'] },
    { key: 'website', label: 'Website', aliases: ['website', 'web', 'url', 'site'] },
    {
      key: 'source',
      label: 'Source',
      aliases: ['source', 'lead source'],
      hint: 'Matched to an active lead source by name; anything else becomes "Import", with the original text kept as source detail.',
    },
    { key: 'sourceDetail', label: 'Source detail', aliases: ['source detail', 'campaign'] },
    { key: 'priority', label: 'Priority', aliases: ['priority'], hint: 'Low, Medium or High (blank = Medium).' },
    {
      key: 'ownerEmail',
      label: 'Owner (user email)',
      aliases: ['owner', 'owner email', 'assigned to', 'assignee', 'salesperson'],
      hint: "An active user's email; anything else makes you the owner.",
    },
    { key: 'requirement', label: 'Requirement', aliases: ['requirement', 'enquiry', 'inquiry', 'message', 'challenge', 'need'] },
    { key: 'notes', label: 'Notes', aliases: ['notes', 'note', 'comments', 'comment'] },
  ],
  contacts: [
    ...NAME_FIELDS,
    {
      key: 'companyName',
      label: 'Company',
      aliases: ['company', 'company name', 'organisation', 'organization', 'account'],
      hint: 'Required on every row (D98). Linked to an existing company with the same name; otherwise a new company is created.',
    },
    { key: 'jobTitle', label: 'Job title', aliases: ['job title', 'title', 'designation', 'role', 'position'] },
    { key: 'department', label: 'Department', aliases: ['department', 'dept', 'team'] },
    { key: 'location', label: 'Location', aliases: ['location', 'city', 'place'] },
    {
      key: 'ownerEmail',
      label: 'Owner (user email)',
      aliases: ['owner', 'owner email', 'assigned to', 'assignee'],
      hint: "An active user's email; anything else makes you the owner.",
    },
    { key: 'notes', label: 'Notes', aliases: ['notes', 'note', 'comments', 'comment'] },
  ],
} as const satisfies Record<ImportEntity, readonly ImportFieldDefinition[]>;

export type LeadImportField = (typeof IMPORT_FIELDS.leads)[number]['key'];
export type ContactImportField = (typeof IMPORT_FIELDS.contacts)[number]['key'];
export type ImportField = LeadImportField | ContactImportField;

const ALL_FIELD_KEYS = [...new Set([...IMPORT_FIELDS.leads, ...IMPORT_FIELDS.contacts].map((field) => field.key))] as [
  ImportField,
  ...ImportField[],
];

export function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/[_\-./]+/g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Suggests a field for each header (first match wins; a field is never suggested twice). */
export function suggestImportMapping(entity: ImportEntity, headers: readonly string[]): (ImportField | null)[] {
  const used = new Set<string>();
  return headers.map((header) => {
    const normalized = normalizeHeader(header);
    const field = IMPORT_FIELDS[entity].find(
      (candidate) => !used.has(candidate.key) && (candidate.aliases as readonly string[]).includes(normalized),
    );
    if (!field) return null;
    used.add(field.key);
    return field.key;
  });
}

/**
 * One request shape for both steps. `csv` is the file's text (the browser
 * reads it; nothing is stored on the server). `mapping[i]` is the field for
 * column i, or null to ignore it; omitted on the first preview so the server
 * can suggest one.
 */
export const importRequestSchema = z
  .object({
    // The byte limit (IMPORT_MAX_BYTES) is checked by the service, in UTF-8 bytes;
    // this character cap only stops absurd payloads before parsing.
    csv: z.string().max(IMPORT_MAX_BYTES * 2, 'The file is larger than 1 MB'),
    mapping: z.array(z.enum(ALL_FIELD_KEYS).nullable()).max(IMPORT_MAX_COLUMNS).optional(),
  })
  .strict();
export type ImportRequest = z.infer<typeof importRequestSchema>;

export const importEntityParamsSchema = z.object({ entity: importEntitySchema });
export type ImportEntityParams = z.infer<typeof importEntityParamsSchema>;

export const IMPORT_ROW_STATUSES = ['ok', 'duplicate', 'error'] as const;
export type ImportRowStatus = (typeof IMPORT_ROW_STATUSES)[number];

export const importPreviewRowSchema = z.object({
  /** Spreadsheet row number: the header is row 1. */
  rowNumber: z.number(),
  status: z.enum(IMPORT_ROW_STATUSES),
  /** Why it is an error or a duplicate. */
  errors: z.array(z.string()),
  /** Things that will happen anyway (e.g. unknown source → "Import"). */
  notes: z.array(z.string()),
  name: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  companyName: z.string().nullable(),
  /** Contacts only: a company this row will create. */
  createsCompany: z.boolean(),
});
export type ImportPreviewRow = z.infer<typeof importPreviewRowSchema>;

export const importSummarySchema = z.object({
  totalRows: z.number(),
  ready: z.number(),
  duplicates: z.number(),
  errors: z.number(),
  blankRowsSkipped: z.number(),
  /** Contacts only: distinct new company names, in file order. */
  companiesToCreate: z.array(z.string()),
  /** Leads only: headers of unmapped columns, kept in each lead's captured fields. */
  keptAsCapturedFields: z.array(z.string()),
});
export type ImportSummary = z.infer<typeof importSummarySchema>;

export const importPreviewResponseSchema = z.object({
  data: z.object({
    headers: z.array(z.string()),
    /** The first non-empty value in each column, to help choose a mapping. */
    samples: z.array(z.string()),
    mapping: z.array(z.string().nullable()),
    /** Mapping problems that block the import (e.g. no name column). */
    mappingErrors: z.array(z.string()),
    summary: importSummarySchema,
    rows: z.array(importPreviewRowSchema),
  }),
});
export type ImportPreviewResponse = z.infer<typeof importPreviewResponseSchema>;

export const importCommitResponseSchema = z.object({
  data: z.object({
    imported: z.number(),
    skippedDuplicates: z.number(),
    errors: z.number(),
    blankRowsSkipped: z.number(),
    companiesCreated: z.number(),
    /** Every skipped row with its reason, as CSV text (BOM included); null when nothing was skipped. */
    errorsCsv: z.string().nullable(),
  }),
});
export type ImportCommitResponse = z.infer<typeof importCommitResponseSchema>;
