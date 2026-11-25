import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { PERMISSIONS, ROLES, ROLE_PERMISSIONS, type ImportPreviewRow } from '@growspark/shared';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';
import { parseCsv } from '../../src/lib/csv-parse.js';
import { createTestTenant, createTwoTestTenants, type TestTenant } from '../helpers/tenant.js';
import { csvLines, importApi } from './helpers.js';
import { ALLOWED_ORIGIN } from '../helpers/http.js';

async function addSource(tenant: TestTenant, name: string, isActive = true) {
  return prisma.leadSource.create({ data: { organizationId: tenant.organization.id, name, sortOrder: 50, isActive } });
}

function rowAt(rows: ImportPreviewRow[], rowNumber: number) {
  return rows.find((row) => row.rowNumber === rowNumber)!;
}

describe('CSV import — leads', () => {
  it('needs a session and leads:write (breaks without the permission check)', async () => {
    const app = createApp();
    const tenant = await createTestTenant();
    await addSource(tenant, 'Import');
    const csv = csvLines('Name,Email', 'Asha Rao,asha@example.test');
    expect((await request(app).post('/api/v1/imports/leads/preview').set('Origin', ALLOWED_ORIGIN).send({ csv })).status).toBe(401);

    const staff = await importApi(app, tenant, 'staff');
    const permissions = ROLE_PERMISSIONS[ROLES.STAFF] as unknown as string[];
    const original = [...permissions];
    try {
      permissions.splice(permissions.indexOf(PERMISSIONS.LEADS_WRITE), 1);
      expect((await staff.preview('leads', csv)).status).toBe(403);
      expect((await staff.commit('leads', csv, ['fullName', 'email'])).status).toBe(403);
      expect((await staff.template('leads')).status).toBe(403);
    } finally {
      permissions.splice(0, permissions.length, ...original);
    }
    expect(await prisma.lead.count({ where: { organizationId: tenant.organization.id } })).toBe(0);
    expect((await staff.preview('leads', csv)).status).toBe(200);
  });

  it('serves a template with fictional data whose headers map automatically and which previews cleanly', async () => {
    const app = createApp();
    const tenant = await createTestTenant();
    await addSource(tenant, 'Import');
    await addSource(tenant, 'Referral');
    await addSource(tenant, 'Event');
    const staff = await importApi(app, tenant);
    const res = await staff.template('leads');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toContain('leads-import-template.csv');
    expect(res.text.startsWith('﻿')).toBe(true);
    expect(res.text).toContain('example.test');

    const preview = await staff.preview('leads', res.text);
    expect(preview.body.data.mappingErrors).toEqual([]);
    expect(preview.body.data.mapping).not.toContain(null);
    expect(preview.body.data.rows.flatMap((row: ImportPreviewRow) => row.errors)).toEqual([]);
    expect(preview.body.data.summary).toMatchObject({ totalRows: 2, ready: 2, errors: 0, duplicates: 0 });
  });

  it('preview suggests a mapping from messy header names, validates every row, and writes nothing', async () => {
    const app = createApp();
    const tenant = await createTestTenant();
    await addSource(tenant, 'Import');
    const staff = await importApi(app, tenant);
    const csv = csvLines(' Full Name ,E-mail,Mobile Number,Organisation,Favourite colour', 'Asha Rao,asha@example.test,98400 12345,Example Foods,Teal');

    const res = await staff.preview('leads', csv);
    expect(res.status).toBe(200);
    expect(res.body.data.headers).toEqual(['Full Name', 'E-mail', 'Mobile Number', 'Organisation', 'Favourite colour']);
    expect(res.body.data.mapping).toEqual(['fullName', 'email', 'phone', 'companyName', null]);
    expect(res.body.data.samples).toEqual(['Asha Rao', 'asha@example.test', '98400 12345', 'Example Foods', 'Teal']);
    expect(res.body.data.summary.keptAsCapturedFields).toEqual(['Favourite colour']);
    expect(res.body.data.rows[0]).toMatchObject({
      rowNumber: 2,
      status: 'ok',
      name: 'Asha Rao',
      phone: '+919840012345',
      companyName: 'Example Foods',
    });
    expect(await prisma.lead.count({ where: { organizationId: tenant.organization.id } })).toBe(0);
    expect(await prisma.auditEvent.count({ where: { organizationId: tenant.organization.id } })).toBe(0);
  });

  it('wrong or missing headers block the import with a clear message; a commit with a bad mapping is 422', async () => {
    const app = createApp();
    const tenant = await createTestTenant();
    await addSource(tenant, 'Import');
    const staff = await importApi(app, tenant);
    const csv = csvLines('Foo,Bar', 'x,y');

    const preview = await staff.preview('leads', csv);
    expect(preview.status).toBe(200);
    expect(preview.body.data.mapping).toEqual([null, null]);
    expect(preview.body.data.mappingErrors).toEqual([
      'Choose a column for First name or Full name.',
      'Choose a column for Email or Phone (each row needs one of them).',
      'Choose a column for Company (each row needs one).',
    ]);
    expect(preview.body.data.rows).toEqual([]);

    expect((await staff.commit('leads', csv, [null, null])).status).toBe(422);
    expect((await staff.commit('leads', csv, ['firstName'])).status).toBe(422); // wrong length
    expect((await staff.commit('leads', csv, ['firstName', 'firstName'])).status).toBe(422); // same field twice
    expect((await staff.commit('leads', csv, ['firstName', 'department'])).status).toBe(422); // a contacts-only field
    expect((await staff.post('/api/v1/imports/leads/commit', { csv })).status).toBe(422); // no mapping at all
    expect(await prisma.lead.count({ where: { organizationId: tenant.organization.id } })).toBe(0);
  });

  it('imports a messy file: BOM, CRLF, blank rows, quotes, formula-like text, bad rows, duplicates — one audit event with the counts', async () => {
    const app = createApp();
    const tenant = await createTestTenant();
    await addSource(tenant, 'Import');
    await addSource(tenant, 'Referral');
    await addSource(tenant, 'Retired', false);
    // An archived lead with an email that the file repeats: still a duplicate.
    await prisma.lead.create({
      data: {
        organizationId: tenant.organization.id,
        firstName: 'Old',
        email: 'OLD@example.test',
        emailNormalized: 'old@example.test',
        sourceId: tenant.leadSource.id,
        archivedAt: new Date(),
      },
    });
    const longNotes = 'x'.repeat(5001);
    const csv =
      '﻿' +
      csvLines(
        'First name,Last name,Email,Phone,Company,Source,Priority,Owner,Notes,Extra',
        'Asha,Rao,asha@example.test,+91 98400 12345,"Rao, Asha & Co",Referral,high,STAFF_EMAIL,"Line one\nLine ""two""",kept',
        '',
        '=HYPERLINK("http://evil.test"),+91,ravi@example.test,,@SUM(A1),Retired,,nobody@example.test,-2+3,',
        ',,,,,,,,,',
        'Meera,,not-an-email,,Test Co,,,,,',
        'Karthik,,,12345,Test Co,,,,,',
        'Divya,,divya@example.test,,Test Co,,urgent,,,',
        'Nisha,,nisha@example.test,,Test Co,,,,,',
        'Nisha Two,,NISHA@example.test,,Test Co,,,,,',
        'Old,,old@example.test,,Test Co,,,,,',
        `Long,,long@example.test,,Test Co,,,,${longNotes},`,
        'Ragged,,ragged@example.test',
        'Trailing,,trailing@example.test,,Test Co,,,,,,',
      ).replace('STAFF_EMAIL', tenant.staffUser.email.toUpperCase());
    const mapping = ['firstName', 'lastName', 'email', 'phone', 'companyName', 'source', 'priority', 'ownerEmail', 'notes', null];
    const admin = await importApi(app, tenant, 'admin');

    const preview = await admin.preview('leads', csv, mapping);
    expect(preview.status).toBe(200);
    const rows = preview.body.data.rows as ImportPreviewRow[];
    expect(preview.body.data.summary).toMatchObject({ totalRows: 11, ready: 4, duplicates: 2, errors: 5, blankRowsSkipped: 2 });
    expect(rowAt(rows, 2).status).toBe('ok');
    expect(rowAt(rows, 4)).toMatchObject({ status: 'ok' });
    expect(rowAt(rows, 4).notes).toEqual([
      'No active user with email "nobody@example.test" — you will be the owner.',
      '"Retired" is not an active lead source — saved as "Import", with "Retired" kept as source detail.',
    ]);
    expect(rowAt(rows, 6).errors).toEqual(['Email "not-an-email" is not a valid email address.']);
    expect(rowAt(rows, 7).errors[0]).toMatch(/^Phone "12345" is not a recognisable number/);
    expect(rowAt(rows, 8).errors).toEqual(['Priority "urgent" must be Low, Medium or High.']);
    expect(rowAt(rows, 10)).toMatchObject({ status: 'duplicate', errors: ['Same email as row 9 — only the first is imported.'] });
    expect(rowAt(rows, 11)).toMatchObject({ status: 'duplicate', errors: ['A lead with this email already exists (archived ones count).'] });
    expect(rowAt(rows, 12).errors).toEqual(['Notes are too long.']);
    // …and, having no Company cell, it also fails D98's company rule.
    expect(rowAt(rows, 13).errors).toEqual(['This row has 3 values but the header has 10 columns.', 'Company name is required.']);
    expect(rowAt(rows, 14).status).toBe('ok'); // one trailing comma too many is harmless

    const commit = await admin.commit('leads', csv, mapping);
    expect(commit.status).toBe(200);
    expect(commit.body.data).toMatchObject({ imported: 4, skippedDuplicates: 2, errors: 5, blankRowsSkipped: 2, companiesCreated: 0 });

    const leads = await prisma.lead.findMany({
      where: { organizationId: tenant.organization.id, archivedAt: null },
      include: { source: true },
      orderBy: { createdAt: 'asc' },
    });
    expect(leads.map((lead) => lead.firstName).sort()).toEqual(['=HYPERLINK("http://evil.test")', 'Asha', 'Nisha', 'Trailing'].sort());
    const asha = leads.find((lead) => lead.firstName === 'Asha')!;
    expect(asha).toMatchObject({
      lastName: 'Rao',
      email: 'asha@example.test',
      emailNormalized: 'asha@example.test',
      phone: '+919840012345',
      companyName: 'Rao, Asha & Co',
      priority: 'HIGH',
      status: 'NEW',
      ownerId: tenant.staffUser.id,
      notes: 'Line one\nLine "two"',
      capturedFields: { Extra: 'kept' },
    });
    expect(asha.source.name).toBe('Referral');
    // Formula-like values are stored exactly as written, never evaluated or altered.
    const formula = leads.find((lead) => lead.email === 'ravi@example.test')!;
    expect(formula).toMatchObject({ lastName: '+91', companyName: '@SUM(A1)', notes: '-2+3', ownerId: tenant.adminUser.id, sourceDetail: 'Retired' });
    expect(formula.source.name).toBe('Import');

    const audits = await prisma.auditEvent.findMany({ where: { organizationId: tenant.organization.id } });
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ action: 'import.completed', entityType: 'lead', actorId: tenant.adminUser.id });
    expect(audits[0]!.metadata).toEqual({
      origin: 'csv_import',
      entity: 'leads',
      totalRows: 11,
      imported: 4,
      skippedDuplicates: 2,
      errors: 5,
      blankRowsSkipped: 2,
      companiesCreated: 0,
    });
    // No notification flood from an import.
    expect(await prisma.notification.count({ where: { organizationId: tenant.organization.id } })).toBe(0);

    // The errors CSV lists every skipped row with its reason; formula-like text is neutralised for spreadsheets.
    const errorsCsv = commit.body.data.errorsCsv as string;
    expect(errorsCsv.startsWith('﻿')).toBe(true);
    const errorRecords = parseCsv(errorsCsv).records;
    expect(errorRecords[0]!.slice(0, 4)).toEqual(['Row', 'Result', 'Problem', 'First name']);
    expect(errorRecords.slice(1).map((record) => record[0])).toEqual(['6', '7', '8', '10', '11', '12', '13']);
    expect(errorRecords.find((record) => record[0] === '10')![1]).toBe('Skipped (duplicate)');
  });

  it('D98: every lead needs a company — rows without one are errors and nothing is created for them', async () => {
    const app = createApp();
    const tenant = await createTestTenant();
    await addSource(tenant, 'Import');
    const staff = await importApi(app, tenant);
    const csv = csvLines('Name,Email,Company', 'Asha Rao,asha@example.test,Example Foods', 'Ravi Kumar,ravi@example.test,', 'Meera Iyer,meera@example.test,   ');

    const preview = await staff.preview('leads', csv, ['fullName', 'email', 'companyName']);
    expect(preview.body.data.summary).toMatchObject({ ready: 1, errors: 2 });
    const rows = preview.body.data.rows as ImportPreviewRow[];
    expect(rowAt(rows, 3)).toMatchObject({ status: 'error', errors: ['Company name is required.'] });
    expect(rowAt(rows, 4)).toMatchObject({ status: 'error', errors: ['Company name is required.'] });

    const commit = await staff.commit('leads', csv, ['fullName', 'email', 'companyName']);
    expect(commit.body.data).toMatchObject({ imported: 1, errors: 2 });
    const leads = await prisma.lead.findMany({ where: { organizationId: tenant.organization.id } });
    expect(leads.map((lead) => lead.companyName)).toEqual(['Example Foods']);
  });

  it('refuses files that are empty, header-only, broken, too big, too long or too wide — and nothing else accepts a big body', async () => {
    const app = createApp();
    const tenant = await createTestTenant();
    await addSource(tenant, 'Import');
    const staff = await importApi(app, tenant);
    const expect422 = async (csv: string, pattern: RegExp) => {
      const res = await staff.preview('leads', csv);
      expect(res.status, csv.slice(0, 40)).toBe(422);
      expect(res.body.error.message).toMatch(pattern);
    };
    await expect422('', /empty/);
    await expect422('\r\n\r\n', /empty/);
    await expect422('Name,Email\r\n', /no data rows/);
    await expect422('Name,Email\r\nAsha,"broken\r\n', /never closed/);
    await expect422(`Name,Email\r\n${'Asha,a@example.test\r\n'.repeat(1001)}`, /at most 1000/);
    await expect422(`${Array.from({ length: 51 }, (_v, i) => `C${i}`).join(',')}\r\nx\r\n`, /at most 50/);
    // 1 MB of UTF-8, counted in bytes (the rupee sign is 3 bytes): ~350,000 characters is over.
    await expect422(`Name,Notes\r\nAsha,${'₹'.repeat(350_000)}\r\n`, /larger than 1 MB/);

    // The JSON body itself is capped at 3 MB on import routes…
    const huge = await staff.preview('leads', 'x'.repeat(3_200_000));
    expect(huge.status).toBe(413);
    // …and every other route keeps 100 KB.
    const admin = await importApi(app, tenant, 'admin');
    const notes = 'n'.repeat(150_000);
    const other = await admin.post('/api/v1/leads', { companyName: 'Fixture Co', firstName: 'Big', email: 'big@example.test', notes });
    expect(other.status).toBe(413);
  });

  it('stays inside the caller’s organisation: another org’s emails, users and sources never match', async () => {
    const app = createApp();
    const [a, b] = await createTwoTestTenants();
    await addSource(a, 'Import');
    await addSource(b, 'Webinar');
    const otherOrgAdmin = await importApi(app, b, 'admin');
    await otherOrgAdmin.post('/api/v1/leads', { companyName: 'Fixture Co', firstName: 'Taken', email: 'taken@example.test', sourceId: b.leadSource.id });

    const csv = csvLines('Name,Email,Owner,Source,Company', `Asha,taken@example.test,${b.adminUser.email},Webinar,Example Foods`);
    const staffA = await importApi(app, a);
    const commit = await staffA.commit('leads', csv, ['fullName', 'email', 'ownerEmail', 'source', 'companyName']);
    expect(commit.body.data).toMatchObject({ imported: 1, skippedDuplicates: 0 });

    const lead = await prisma.lead.findFirstOrThrow({ where: { email: 'taken@example.test', organizationId: a.organization.id }, include: { source: true } });
    expect(lead.ownerId).toBe(a.staffUser.id);
    expect(lead.source.name).toBe('Import');
    expect(await prisma.lead.count({ where: { organizationId: b.organization.id } })).toBe(1);
  });

  it('two imports of the same file at once create each lead only once (breaks without the lock)', async () => {
    const app = createApp();
    const tenant = await createTestTenant();
    await addSource(tenant, 'Import');
    const staff = await importApi(app, tenant);
    const lines = Array.from({ length: 20 }, (_v, i) => `Person ${i},p${i}@example.test,Company ${i}`);
    const csv = csvLines('Name,Email,Company', ...lines);
    const [first, second] = await Promise.all([
      staff.commit('leads', csv, ['fullName', 'email', 'companyName']),
      staff.commit('leads', csv, ['fullName', 'email', 'companyName']),
    ]);
    expect([first.status, second.status]).toEqual([200, 200]);
    expect([first.body.data.imported, second.body.data.imported].sort()).toEqual([0, 20]);
    expect(await prisma.lead.count({ where: { organizationId: tenant.organization.id } })).toBe(20);
  });

  it('D99: phones are read the way the phone input reads a paste — leading 0, missing +, spaces and dashes', async () => {
    const app = createApp();
    const tenant = await createTestTenant();
    await addSource(tenant, 'Import');
    const staff = await importApi(app, tenant);
    const csv = csvLines(
      'Name,Email,Phone,Company',
      'Asha Rao,asha@example.test,098400 12345,Example Foods',
      'Ravi Kumar,ravi@example.test,91-98450-67890,Example Foods',
      'Meera Iyer,meera@example.test,+44 20 7946 0958,Example Foods',
      'Divya Nair,divya@example.test,044 2345 6789,Example Foods',
      'Karthik Das,karthik@example.test,98400 123456,Example Foods',
    );
    const commit = await staff.commit('leads', csv, ['fullName', 'email', 'phone', 'companyName']);
    expect(commit.body.data).toMatchObject({ imported: 4, errors: 1 });
    const leads = await prisma.lead.findMany({ where: { organizationId: tenant.organization.id }, orderBy: { email: 'asc' } });
    expect(Object.fromEntries(leads.map((lead) => [lead.email, lead.phone]))).toEqual({
      'asha@example.test': '+919840012345',
      'ravi@example.test': '+919845067890',
      'meera@example.test': '+442079460958',
      'divya@example.test': '+914423456789',
    });
  });
});
