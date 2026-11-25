import { z } from 'zod';
import {
  IMPORT_FIELDS,
  IMPORT_MAX_BYTES,
  IMPORT_MAX_COLUMNS,
  IMPORT_MAX_ROWS,
  PERMISSIONS,
  PRIORITIES,
  createContactSchema,
  createLeadSchema,
  hasPermission,
  isValidManualEntryPhone,
  normalizeCompanyName,
  normalizeEmail,
  normalizePhone,
  parsePhoneLenient,
  suggestImportMapping,
  type ImportCommitResponse,
  type ImportEntity,
  type ImportField,
  type ImportPreviewResponse,
  type ImportPreviewRow,
  type Priority,
} from '@growspark/shared';
import { prisma } from '../../db/prisma.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { ApiError } from '../../middleware/error-handler.js';
import { writeAudit } from '../../lib/audit.js';
import { scoped } from '../../lib/scoped.js';
import { CsvParseError, isBlankRecord, parseCsv } from '../../lib/csv-parse.js';
import { restoreNeutralizedCell, rowsToCsv } from '../../lib/csv.js';
import type { RequestContext } from '../../lib/context.js';

/**
 * CSV import of leads and contacts (D95). Stateless: preview and commit each
 * receive the whole file text, and commit parses and validates it again from
 * scratch, so nothing a browser sends back from a preview is ever trusted and
 * no file is stored. Rows are validated with the same shared create schemas
 * manual entry uses; formula-like text is stored as plain text, exactly as
 * written (the CSV export neutralises it on the way out).
 */

type Db = Prisma.TransactionClient | typeof prisma;

// ---------------------------------------------------------------------------
// File and mapping
// ---------------------------------------------------------------------------

interface DataRecord {
  /** Spreadsheet row number: the header is row 1. */
  rowNumber: number;
  cells: string[];
}

interface PreparedFile {
  headers: string[];
  records: DataRecord[];
  blankRowsSkipped: number;
}

function fileError(message: string): never {
  throw new ApiError(422, 'VALIDATION_FAILED', message, [{ path: 'csv', message }]);
}

export function prepareFile(csv: string): PreparedFile {
  if (Buffer.byteLength(csv, 'utf8') > IMPORT_MAX_BYTES) fileError('The file is larger than 1 MB. Split it into smaller files.');
  let records: string[][];
  try {
    records = parseCsv(csv).records;
  } catch (err) {
    if (err instanceof CsvParseError) fileError(err.message);
    throw err;
  }
  const headerIndex = records.findIndex((record) => !isBlankRecord(record));
  if (headerIndex === -1) fileError('The file is empty.');
  const headers = records[headerIndex]!.map((header, index) => header.trim() || `Column ${index + 1}`);
  if (headers.length > IMPORT_MAX_COLUMNS) fileError(`The file has ${headers.length} columns; at most ${IMPORT_MAX_COLUMNS} are allowed.`);

  const data: DataRecord[] = [];
  let blankRowsSkipped = 0;
  records.slice(headerIndex + 1).forEach((cells, offset) => {
    if (isBlankRecord(cells)) {
      blankRowsSkipped += 1;
      return;
    }
    data.push({ rowNumber: headerIndex + 2 + offset, cells: cells.map(restoreNeutralizedCell) });
  });
  if (data.length === 0) fileError('The file has a header row but no data rows.');
  if (data.length > IMPORT_MAX_ROWS) fileError(`The file has ${data.length} rows; at most ${IMPORT_MAX_ROWS} can be imported at once.`);
  return { headers, records: data, blankRowsSkipped };
}

function fieldLabel(entity: ImportEntity, key: string): string {
  return IMPORT_FIELDS[entity].find((field) => field.key === key)?.label ?? key;
}

/** Problems that stop the whole import (not one row). Empty = fine. */
export function mappingProblems(entity: ImportEntity, headers: string[], mapping: (ImportField | null)[]): string[] {
  const problems: string[] = [];
  if (mapping.length !== headers.length) {
    return [`The column mapping has ${mapping.length} entries but the file has ${headers.length} columns.`];
  }
  const allowed = new Set<string>(IMPORT_FIELDS[entity].map((field) => field.key));
  const seen = new Map<string, number>();
  mapping.forEach((field, index) => {
    if (!field) return;
    if (!allowed.has(field)) {
      problems.push(`"${field}" is not a field you can import ${entity} into.`);
      return;
    }
    if (seen.has(field)) {
      problems.push(`${fieldLabel(entity, field)} is chosen for two columns ("${headers[seen.get(field)!]}" and "${headers[index]}").`);
    }
    seen.set(field, index);
  });
  if (!seen.has('firstName') && !seen.has('fullName')) problems.push('Choose a column for First name or Full name.');
  if (!seen.has('email') && !seen.has('phone')) problems.push('Choose a column for Email or Phone (each row needs one of them).');
  return problems;
}

// ---------------------------------------------------------------------------
// Lookups (one query each, organisation-scoped)
// ---------------------------------------------------------------------------

interface Lookups {
  existingEmails: Set<string>;
  activeUsersByEmail: Map<string, string>;
  activeSourcesByName: Map<string, string>;
  importSourceId: string | null;
  companiesByName: Map<string, string>;
}

function cellFor(record: DataRecord, mapping: (ImportField | null)[], field: ImportField): string | undefined {
  const index = mapping.indexOf(field);
  if (index === -1) return undefined;
  const value = record.cells[index]?.trim();
  return value ? value : undefined;
}

async function loadLookups(db: Db, ctx: RequestContext, entity: ImportEntity, file: PreparedFile, mapping: (ImportField | null)[]): Promise<Lookups> {
  const emails = [
    ...new Set(file.records.map((record) => normalizeEmail(cellFor(record, mapping, 'email'))).filter((e): e is string => Boolean(e))),
  ];
  // Archived records count as duplicates too (the user's decision).
  const existing =
    entity === 'leads'
      ? await db.lead.findMany({ where: { ...scoped(ctx), emailNormalized: { in: emails } }, select: { emailNormalized: true } })
      : await db.contact.findMany({ where: { ...scoped(ctx), emailNormalized: { in: emails } }, select: { emailNormalized: true } });

  const users = await db.user.findMany({ where: { ...scoped(ctx), isActive: true }, select: { id: true, email: true } });

  const lookups: Lookups = {
    existingEmails: new Set(existing.map((row) => row.emailNormalized!).filter(Boolean)),
    activeUsersByEmail: new Map(users.map((user) => [user.email.toLowerCase(), user.id])),
    activeSourcesByName: new Map(),
    importSourceId: null,
    companiesByName: new Map(),
  };

  if (entity === 'leads') {
    const sources = await db.leadSource.findMany({ where: scoped(ctx), select: { id: true, name: true, isActive: true } });
    for (const source of sources) {
      if (source.isActive) lookups.activeSourcesByName.set(source.name.toLowerCase(), source.id);
      if (source.name === 'Import') lookups.importSourceId = source.id;
    }
  } else {
    const names = [
      ...new Set(
        file.records
          .map((record) => normalizeCompanyName(cellFor(record, mapping, 'companyName')))
          .filter((name): name is string => Boolean(name)),
      ),
    ];
    // Only active companies are linked; the oldest wins if two share a name.
    const companies = await db.company.findMany({
      where: { ...scoped(ctx), archivedAt: null, nameNormalized: { in: names } },
      orderBy: { createdAt: 'asc' },
      select: { id: true, nameNormalized: true },
    });
    for (const company of companies) {
      if (!lookups.companiesByName.has(company.nameNormalized)) lookups.companiesByName.set(company.nameNormalized, company.id);
    }
  }
  return lookups;
}

// ---------------------------------------------------------------------------
// Row evaluation
// ---------------------------------------------------------------------------

const emailFormat = z.email();

interface EvaluatedRow extends ImportPreviewRow {
  cells: string[];
  /** Present only when status is "ok". */
  lead?: Prisma.LeadCreateManyInput;
  contact?: Omit<Prisma.ContactCreateManyInput, 'companyId'> & { companyKey: string | null; companyId: string | null };
  /** Contacts: the company display name for a company this row would create. */
  newCompanyName?: string;
}

function splitName(fullName: string): { first: string; last: string | undefined } {
  const [first, ...rest] = fullName.split(/\s+/);
  return { first: first!, last: rest.length ? rest.join(' ') : undefined };
}

/**
 * Shared-schema issues as row messages. `contactGiven`: an email or phone was
 * typed but rejected above, so the schema's generic "needs an email or a
 * phone" would only repeat that error.
 */
function zodMessages(entity: ImportEntity, error: z.ZodError, contactGiven = false): string[] {
  return error.issues.flatMap((issue) => {
    const key = String(issue.path[0] ?? '');
    if (issue.message === 'Provide an email or a phone number') return contactGiven ? [] : ['Needs an email or a phone number.'];
    const label = key === 'companyId' ? 'Company' : fieldLabel(entity, key);
    return [issue.message.toLowerCase().startsWith(label.toLowerCase()) ? `${issue.message}.` : `${label}: ${issue.message}.`];
  });
}

export function evaluateRows(
  ctx: RequestContext,
  entity: ImportEntity,
  file: PreparedFile,
  mapping: (ImportField | null)[],
  lookups: Lookups,
): EvaluatedRow[] {
  const seenEmails = new Map<string, number>();
  const unmappedColumns = file.headers.map((_header, index) => index).filter((index) => !mapping[index]);

  return file.records.map((record) => {
    const errors: string[] = [];
    const notes: string[] = [];
    let cells = record.cells;
    // Trailing empty cells (a trailing comma) are harmless; any other count mismatch is an error.
    if (cells.length > file.headers.length && cells.slice(file.headers.length).every((cell) => cell.trim() === '')) {
      cells = cells.slice(0, file.headers.length);
    }
    if (cells.length !== file.headers.length) {
      errors.push(`This row has ${cells.length} values but the header has ${file.headers.length} columns.`);
    }
    const get = (field: ImportField) => cellFor({ ...record, cells }, mapping, field);

    let firstName = get('firstName');
    let lastName = get('lastName');
    const fullName = get('fullName');
    if (!firstName && fullName) {
      const split = splitName(fullName);
      firstName = split.first;
      lastName = lastName ?? split.last;
    }

    const email = get('email');
    if (email && !emailFormat.safeParse(email).success) errors.push(`Email "${email}" is not a valid email address.`);

    const rawPhone = get('phone');
    let phone: string | undefined;
    if (rawPhone) {
      const parsed = parsePhoneLenient(rawPhone);
      if (parsed && isValidManualEntryPhone(parsed)) phone = parsed;
      else errors.push(`Phone "${rawPhone}" is not a recognisable number — include the country code, e.g. +91 98400 12345.`);
    }

    let ownerId = ctx.userId;
    const ownerEmail = get('ownerEmail');
    if (ownerEmail) {
      const match = lookups.activeUsersByEmail.get(ownerEmail.toLowerCase());
      if (match) ownerId = match;
      else notes.push(`No active user with email "${ownerEmail}" — you will be the owner.`);
    }

    const companyName = get('companyName');
    const base = {
      firstName: firstName ?? '',
      lastName,
      email,
      phone,
      jobTitle: get('jobTitle'),
      notes: get('notes'),
      ownerId,
    };

    const row: EvaluatedRow = {
      rowNumber: record.rowNumber,
      status: 'ok',
      errors,
      notes,
      name: [firstName, lastName].filter(Boolean).join(' '),
      email: email ?? null,
      phone: phone ?? rawPhone ?? null,
      companyName: companyName ?? null,
      createsCompany: false,
      cells: record.cells,
    };

    if (entity === 'leads') {
      let priority: Priority | undefined;
      const rawPriority = get('priority');
      if (rawPriority) {
        const upper = rawPriority.toUpperCase();
        if ((PRIORITIES as readonly string[]).includes(upper)) priority = upper as Priority;
        else errors.push(`Priority "${rawPriority}" must be Low, Medium or High.`);
      }
      let sourceId = lookups.importSourceId ?? undefined;
      let sourceDetail = get('sourceDetail');
      const rawSource = get('source');
      if (rawSource) {
        const match = lookups.activeSourcesByName.get(rawSource.toLowerCase());
        if (match) sourceId = match;
        else {
          notes.push(`"${rawSource}" is not an active lead source — saved as "Import", with "${rawSource}" kept as source detail.`);
          sourceDetail = sourceDetail ?? rawSource;
        }
      }
      if (!sourceId) errors.push('The "Import" lead source is missing — ask an Admin to check Settings → Lead sources.');

      // Columns not mapped to any field are kept on the lead, so nothing typed is lost (PRD §9).
      const captured: Record<string, string> = {};
      for (const index of unmappedColumns) {
        const value = cells[index]?.trim();
        if (!value) continue;
        const header = file.headers[index]!;
        captured[captured[header] === undefined ? header : `${header} (column ${index + 1})`] = value;
      }

      const input = {
        ...base,
        companyName,
        industry: get('industry'),
        website: get('website'),
        sourceId,
        sourceDetail,
        priority,
        requirement: get('requirement'),
        ...(Object.keys(captured).length ? { capturedFields: captured } : {}),
      };
      const parsed = createLeadSchema.safeParse(input);
      if (!parsed.success) errors.push(...zodMessages(entity, parsed.error, Boolean(email || rawPhone)));
      else if (errors.length === 0) {
        const value = parsed.data;
        row.lead = {
          organizationId: ctx.orgId,
          firstName: value.firstName,
          lastName: value.lastName ?? null,
          email: value.email ?? null,
          emailNormalized: normalizeEmail(value.email),
          phone: value.phone ?? null,
          phoneNormalized: normalizePhone(value.phone),
          companyName: value.companyName ?? null,
          companyNameNormalized: normalizeCompanyName(value.companyName),
          website: value.website ?? null,
          jobTitle: value.jobTitle ?? null,
          industry: value.industry ?? null,
          sourceId: value.sourceId!,
          sourceDetail: value.sourceDetail ?? null,
          priority: value.priority ?? 'MEDIUM',
          ownerId: value.ownerId ?? null,
          requirement: value.requirement ?? null,
          notes: value.notes ?? null,
          ...(value.capturedFields ? { capturedFields: value.capturedFields as Prisma.InputJsonValue } : {}),
        };
      }
    } else {
      const companyKey = normalizeCompanyName(companyName);
      const existingCompanyId = companyKey ? lookups.companiesByName.get(companyKey) : undefined;
      const input = { ...base, department: get('department'), location: get('location') };
      const parsed = createContactSchema.safeParse(input);
      if (companyName && companyName.length > 300) errors.push('Company: name is too long (300 characters at most).');
      if (!parsed.success) errors.push(...zodMessages(entity, parsed.error, Boolean(email || rawPhone)));
      else if (errors.length === 0) {
        const value = parsed.data;
        row.contact = {
          organizationId: ctx.orgId,
          companyKey: existingCompanyId ? null : companyKey,
          companyId: existingCompanyId ?? null,
          firstName: value.firstName,
          lastName: value.lastName ?? null,
          email: value.email ?? null,
          emailNormalized: normalizeEmail(value.email),
          phone: value.phone ?? null,
          phoneNormalized: normalizePhone(value.phone),
          jobTitle: value.jobTitle ?? null,
          department: value.department ?? null,
          location: value.location ?? null,
          ownerId: value.ownerId ?? null,
          notes: value.notes ?? null,
        };
        if (companyName && companyKey && !existingCompanyId) {
          row.createsCompany = true;
          row.newCompanyName = companyName;
        }
      }
    }

    // Duplicates — only for rows that are otherwise valid (an invalid row
    // won't be imported, so it must not block a later row with the same email).
    const emailKey = normalizeEmail(email);
    if (errors.length === 0 && emailKey) {
      const noun = entity === 'leads' ? 'lead' : 'contact';
      if (lookups.existingEmails.has(emailKey)) {
        errors.push(`A ${noun} with this email already exists (archived ones count).`);
        row.status = 'duplicate';
      } else if (seenEmails.has(emailKey)) {
        errors.push(`Same email as row ${seenEmails.get(emailKey)} — only the first is imported.`);
        row.status = 'duplicate';
      } else {
        seenEmails.set(emailKey, record.rowNumber);
      }
    }
    if (row.status !== 'duplicate' && errors.length > 0) row.status = 'error';
    if (row.status !== 'ok') {
      delete row.lead;
      delete row.contact;
      row.createsCompany = false;
      delete row.newCompanyName;
    } else if (row.createsCompany) {
      notes.push(`Will create company "${row.newCompanyName}".`);
    }
    return row;
  });
}

function companiesToCreate(rows: EvaluatedRow[]): Map<string, string> {
  const companies = new Map<string, string>();
  for (const row of rows) {
    const key = row.contact?.companyKey;
    if (row.status === 'ok' && key && !companies.has(key)) companies.set(key, row.newCompanyName!);
  }
  return companies;
}

function toPreviewRow(row: EvaluatedRow): ImportPreviewRow {
  return {
    rowNumber: row.rowNumber,
    status: row.status,
    errors: row.errors,
    notes: row.notes,
    name: row.name,
    email: row.email,
    phone: row.phone,
    companyName: row.companyName,
    createsCompany: row.createsCompany,
  };
}

function assertCanCreateCompanies(ctx: RequestContext, count: number): void {
  if (count > 0 && !hasPermission(ctx.role, PERMISSIONS.COMPANIES_WRITE)) {
    throw new ApiError(403, 'FORBIDDEN', 'This import would create companies, which your role cannot do.');
  }
}

// ---------------------------------------------------------------------------
// Preview and commit
// ---------------------------------------------------------------------------

export async function previewImport(
  ctx: RequestContext,
  entity: ImportEntity,
  csv: string,
  requestedMapping: (ImportField | null)[] | undefined,
): Promise<ImportPreviewResponse['data']> {
  const file = prepareFile(csv);
  const mapping = requestedMapping ?? suggestImportMapping(entity, file.headers);
  const problems = mappingProblems(entity, file.headers, mapping);
  const samples = file.headers.map((_header, index) => {
    const value = file.records.map((record) => record.cells[index]?.trim() ?? '').find(Boolean) ?? '';
    return value.length > 80 ? `${value.slice(0, 80)}…` : value;
  });
  const summaryBase = {
    totalRows: file.records.length,
    blankRowsSkipped: file.blankRowsSkipped,
  };
  if (problems.length > 0) {
    return {
      headers: file.headers,
      samples,
      mapping,
      mappingErrors: problems,
      summary: { ...summaryBase, ready: 0, duplicates: 0, errors: 0, companiesToCreate: [], keptAsCapturedFields: [] },
      rows: [],
    };
  }
  const lookups = await loadLookups(prisma, ctx, entity, file, mapping);
  const rows = evaluateRows(ctx, entity, file, mapping, lookups);
  return {
    headers: file.headers,
    samples,
    mapping,
    mappingErrors: [],
    summary: {
      ...summaryBase,
      ready: rows.filter((row) => row.status === 'ok').length,
      duplicates: rows.filter((row) => row.status === 'duplicate').length,
      errors: rows.filter((row) => row.status === 'error').length,
      companiesToCreate: [...companiesToCreate(rows).values()],
      keptAsCapturedFields: entity === 'leads' ? file.headers.filter((_header, index) => !mapping[index]) : [],
    },
    rows: rows.map(toPreviewRow),
  };
}

function buildErrorsCsv(file: PreparedFile, rows: EvaluatedRow[]): string | null {
  const skipped = rows.filter((row) => row.status !== 'ok');
  if (skipped.length === 0) return null;
  return rowsToCsv(skipped, [
    { header: 'Row', value: (row) => row.rowNumber },
    { header: 'Result', value: (row) => (row.status === 'duplicate' ? 'Skipped (duplicate)' : 'Error') },
    { header: 'Problem', value: (row) => row.errors.join(' ') },
    ...file.headers.map((header, index) => ({ header, value: (row: EvaluatedRow) => row.cells[index] ?? '' })),
  ]);
}

/**
 * Re-parses and re-validates everything, then inserts every valid row in one
 * transaction with one audit event. The organisation row is locked first
 * (the same per-tenant lock Settings uses), so two imports of the same file
 * at once cannot both pass the duplicate check.
 */
export async function commitImport(
  ctx: RequestContext,
  entity: ImportEntity,
  csv: string,
  mapping: (ImportField | null)[] | undefined,
): Promise<ImportCommitResponse['data']> {
  if (!mapping) fileError('Choose a column mapping before importing.');
  const file = prepareFile(csv);
  const problems = mappingProblems(entity, file.headers, mapping);
  if (problems.length > 0) {
    throw new ApiError(422, 'VALIDATION_FAILED', problems.join(' '), problems.map((message) => ({ path: 'mapping', message })));
  }

  const result = await prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${ctx.orgId}::uuid FOR UPDATE`;
      const lookups = await loadLookups(tx, ctx, entity, file, mapping);
      const rows = evaluateRows(ctx, entity, file, mapping, lookups);
      const okRows = rows.filter((row) => row.status === 'ok');
      let companiesCreated = 0;

      if (entity === 'leads') {
        if (okRows.length) await tx.lead.createMany({ data: okRows.map((row) => row.lead!) });
      } else {
        const newCompanies = companiesToCreate(rows);
        assertCanCreateCompanies(ctx, newCompanies.size);
        const companyIds = new Map<string, string>();
        if (newCompanies.size) {
          const created = await tx.company.createManyAndReturn({
            data: [...newCompanies.entries()].map(([key, name]) => ({
              organizationId: ctx.orgId,
              name,
              nameNormalized: key,
              ownerId: ctx.userId,
            })),
            select: { id: true, nameNormalized: true },
          });
          for (const company of created) companyIds.set(company.nameNormalized, company.id);
          companiesCreated = created.length;
        }
        if (okRows.length) {
          await tx.contact.createMany({
            data: okRows.map((row) => {
              const { companyKey, companyId, ...contact } = row.contact!;
              return { ...contact, companyId: companyId ?? (companyKey ? companyIds.get(companyKey)! : null) };
            }),
          });
        }
      }

      const counts = {
        totalRows: rows.length,
        imported: okRows.length,
        skippedDuplicates: rows.filter((row) => row.status === 'duplicate').length,
        errors: rows.filter((row) => row.status === 'error').length,
        blankRowsSkipped: file.blankRowsSkipped,
        companiesCreated,
      };
      await writeAudit(tx, ctx, {
        action: 'import.completed',
        entityType: entity === 'leads' ? 'lead' : 'contact',
        metadata: { origin: 'csv_import', entity, ...counts },
      });
      return { counts, rows };
    },
    { timeout: 60_000, maxWait: 10_000 },
  );

  return { ...result.counts, errorsCsv: buildErrorsCsv(file, result.rows) };
}

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------

const TEMPLATE_ROWS: Record<ImportEntity, Record<string, string>[]> = {
  leads: [
    {
      firstName: 'Asha',
      lastName: 'Rao',
      email: 'asha.rao@example.test',
      phone: '+91 98400 12345',
      companyName: 'Example Foods Pvt Ltd',
      jobTitle: 'Operations Head',
      source: 'Referral',
      priority: 'High',
      requirement: 'Manual order tracking is slowing our plants.',
    },
    {
      firstName: 'Vikram',
      lastName: 'Menon',
      email: 'vikram.menon@example.test',
      phone: '',
      companyName: 'Sample Textiles',
      jobTitle: 'Director',
      source: 'Event',
      priority: 'Medium',
      requirement: 'Wants a quote for process mapping.',
    },
  ],
  contacts: [
    {
      firstName: 'Meera',
      lastName: 'Iyer',
      email: 'meera.iyer@example.test',
      phone: '+91 98450 67890',
      companyName: 'Example Foods Pvt Ltd',
      jobTitle: 'Finance Manager',
      department: 'Finance',
      location: 'Chennai',
    },
    {
      firstName: 'Karthik',
      lastName: 'Nair',
      email: 'karthik.nair@example.test',
      phone: '',
      companyName: 'Sample Textiles',
      jobTitle: 'Plant Manager',
      department: 'Operations',
      location: 'Coimbatore',
    },
  ],
};

const TEMPLATE_COLUMNS: Record<ImportEntity, string[]> = {
  leads: ['firstName', 'lastName', 'email', 'phone', 'companyName', 'jobTitle', 'source', 'priority', 'requirement'],
  contacts: ['firstName', 'lastName', 'email', 'phone', 'companyName', 'jobTitle', 'department', 'location'],
};

/** A small sample file with fictional data, its headers spelled so they map automatically. */
export function buildTemplateCsv(entity: ImportEntity): string {
  return rowsToCsv(
    TEMPLATE_ROWS[entity],
    TEMPLATE_COLUMNS[entity].map((key) => ({ header: fieldLabel(entity, key), value: (row: Record<string, string>) => row[key] ?? '' })),
  );
}
