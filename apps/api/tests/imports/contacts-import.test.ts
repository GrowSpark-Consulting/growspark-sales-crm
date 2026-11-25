import { describe, expect, it } from 'vitest';
import { PERMISSIONS, ROLES, ROLE_PERMISSIONS, type ImportPreviewRow } from '@growspark/shared';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';
import { createTestTenant, createTwoTestTenants, type TestTenant } from '../helpers/tenant.js';
import { csvLines, importApi } from './helpers.js';

async function company(tenant: TestTenant, name: string, archived = false) {
  return prisma.company.create({
    data: {
      organizationId: tenant.organization.id,
      name,
      nameNormalized: name.toLowerCase(),
      ...(archived ? { archivedAt: new Date() } : {}),
    },
  });
}

const MAPPING = ['fullName', 'email', 'phone', 'companyName', 'jobTitle'];

describe('CSV import — contacts', () => {
  it('links an existing company by name, creates each unknown company once (shown in the preview), and audits one import', async () => {
    const app = createApp();
    const tenant = await createTestTenant();
    const existing = await company(tenant, 'example foods');
    const archived = await company(tenant, 'old mills', true);
    const csv = csvLines(
      'Name,Email,Phone,Company,Title',
      'Meera Iyer,meera@example.test,+91 98450 67890,Example Foods,Finance Manager',
      'Karthik Nair,karthik@example.test,,Sample Textiles,Plant Manager',
      'Divya Rao,divya@example.test,,SAMPLE TEXTILES,Buyer',
      'Arun Das,arun@example.test,,Old Mills,Owner',
      'No Company,nocompany@example.test,,,',
      'Bad Email,bad-email,,Never Made Ltd,',
    );
    const staff = await importApi(app, tenant);

    const preview = await staff.preview('contacts', csv);
    expect(preview.body.data.mapping).toEqual(MAPPING);
    expect(preview.body.data.summary).toMatchObject({ ready: 5, errors: 1, companiesToCreate: ['Sample Textiles', 'Old Mills'] });
    const rows = preview.body.data.rows as ImportPreviewRow[];
    expect(rows.map((row) => row.createsCompany)).toEqual([false, true, true, true, false, false]);
    expect(rows[1]!.notes).toContain('Will create company "Sample Textiles".');
    // A row that will not be imported never creates a company.
    expect(preview.body.data.summary.companiesToCreate).not.toContain('Never Made Ltd');
    expect(await prisma.company.count({ where: { organizationId: tenant.organization.id } })).toBe(2);

    const commit = await staff.commit('contacts', csv, MAPPING);
    expect(commit.status).toBe(200);
    expect(commit.body.data).toMatchObject({ imported: 5, errors: 1, skippedDuplicates: 0, companiesCreated: 2 });

    const contacts = await prisma.contact.findMany({ where: { organizationId: tenant.organization.id }, include: { company: true } });
    const byEmail = Object.fromEntries(contacts.map((contact) => [contact.email, contact]));
    expect(byEmail['meera@example.test']!.companyId).toBe(existing.id);
    expect(byEmail['meera@example.test']).toMatchObject({ firstName: 'Meera', lastName: 'Iyer', phone: '+919845067890', jobTitle: 'Finance Manager', ownerId: tenant.staffUser.id });
    expect(byEmail['karthik@example.test']!.companyId).toBe(byEmail['divya@example.test']!.companyId);
    expect(byEmail['karthik@example.test']!.company!.name).toBe('Sample Textiles');
    // An archived company is never linked: a fresh one is created instead.
    expect(byEmail['arun@example.test']!.companyId).not.toBe(archived.id);
    expect(byEmail['nocompany@example.test']!.companyId).toBeNull();
    expect(await prisma.company.count({ where: { organizationId: tenant.organization.id, name: 'Never Made Ltd' } })).toBe(0);

    const audits = await prisma.auditEvent.findMany({ where: { organizationId: tenant.organization.id } });
    expect(audits).toHaveLength(1);
    expect(audits[0]!.metadata).toEqual({
      origin: 'csv_import',
      entity: 'contacts',
      totalRows: 6,
      imported: 5,
      skippedDuplicates: 0,
      errors: 1,
      blankRowsSkipped: 0,
      companiesCreated: 2,
    });
  });

  it('skips duplicate emails — existing (archived included) and repeated within the file (breaks without the duplicate check)', async () => {
    const app = createApp();
    const tenant = await createTestTenant();
    await prisma.contact.create({
      data: { organizationId: tenant.organization.id, firstName: 'Gone', email: 'gone@example.test', emailNormalized: 'gone@example.test', archivedAt: new Date() },
    });
    const csv = csvLines(
      'Name,Email,Phone,Company,Title',
      'One,gone@example.test,,,',
      'Two,twice@example.test,,,',
      'Three,TWICE@example.test,,,',
    );
    const staff = await importApi(app, tenant);
    const commit = await staff.commit('contacts', csv, MAPPING);
    expect(commit.body.data).toMatchObject({ imported: 1, skippedDuplicates: 2 });
    expect(await prisma.contact.count({ where: { organizationId: tenant.organization.id, archivedAt: null } })).toBe(1);
  });

  it('needs contacts:write, and companies:write when the file would create a company', async () => {
    const app = createApp();
    const tenant = await createTestTenant();
    const staff = await importApi(app, tenant);
    const permissions = ROLE_PERMISSIONS[ROLES.STAFF] as unknown as string[];
    const original = [...permissions];
    const withCompany = csvLines('Name,Email,Phone,Company,Title', 'Meera,meera@example.test,,Brand New Co,');
    const withoutCompany = csvLines('Name,Email,Phone,Company,Title', 'Meera,meera@example.test,,,');
    try {
      permissions.splice(permissions.indexOf(PERMISSIONS.COMPANIES_WRITE), 1);
      expect((await staff.commit('contacts', withCompany, MAPPING)).status).toBe(403);
      expect(await prisma.contact.count({ where: { organizationId: tenant.organization.id } })).toBe(0);
      expect((await staff.commit('contacts', withoutCompany, MAPPING)).status).toBe(200);
      permissions.splice(permissions.indexOf(PERMISSIONS.CONTACTS_WRITE), 1);
      expect((await staff.preview('contacts', withoutCompany)).status).toBe(403);
    } finally {
      permissions.splice(0, permissions.length, ...original);
    }
  });

  it('never links to, or counts duplicates in, another organisation', async () => {
    const app = createApp();
    const [a, b] = await createTwoTestTenants();
    const otherCompany = await company(b, 'shared name ltd');
    await prisma.contact.create({
      data: { organizationId: b.organization.id, firstName: 'B', email: 'same@example.test', emailNormalized: 'same@example.test' },
    });
    const staffA = await importApi(app, a);
    const commit = await staffA.commit('contacts', csvLines('Name,Email,Phone,Company,Title', 'Asha,same@example.test,,Shared Name Ltd,'), MAPPING);
    expect(commit.body.data).toMatchObject({ imported: 1, skippedDuplicates: 0, companiesCreated: 1 });
    const contact = await prisma.contact.findFirstOrThrow({ where: { organizationId: a.organization.id } });
    expect(contact.companyId).not.toBe(otherCompany.id);
    const linked = await prisma.company.findUniqueOrThrow({ where: { id: contact.companyId! } });
    expect(linked.organizationId).toBe(a.organization.id);
  });

  it('re-imports a contacts file exported by this app (its "\'+91…" phone guard is undone)', async () => {
    const app = createApp();
    const tenant = await createTestTenant();
    const staff = await importApi(app, tenant);
    const exported = '﻿' + csvLines('First name,Last name,Email,Phone', "Asha,Rao,asha@example.test,'+919840012345");
    const preview = await staff.preview('contacts', exported);
    expect(preview.body.data.rows[0]).toMatchObject({ status: 'ok', phone: '+919840012345' });
  });
});
