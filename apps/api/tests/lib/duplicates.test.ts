import { describe, expect, it } from 'vitest';
import { ROLES, normalizeEmail, normalizePhone, normalizeCompanyName } from '@growspark/shared';
import { prisma } from '../../src/db/prisma.js';
import { findDuplicateCompanies, findDuplicateContacts, findDuplicateLeads } from '../../src/lib/duplicates.js';
import { createTestTenant, createTwoTestTenants } from '../helpers/tenant.js';
import type { RequestContext } from '../../src/lib/context.js';

function ctxFor(organizationId: string, userId: string): RequestContext {
  return { orgId: organizationId, userId, role: ROLES.ADMIN };
}

describe('findDuplicateCompanies', () => {
  it('matches on normalised name and reports the reason', async () => {
    const tenant = await createTestTenant();
    const ctx = ctxFor(tenant.organization.id, tenant.adminUser.id);
    const existing = await prisma.company.create({
      data: {
        organizationId: tenant.organization.id,
        name: 'Example Foods Pvt Ltd',
        nameNormalized: normalizeCompanyName('Example Foods Pvt Ltd')!,
      },
    });

    const matches = await findDuplicateCompanies(ctx, normalizeCompanyName('EXAMPLE FOODS'));
    expect(matches).toEqual([{ id: existing.id, reason: 'companyName' }]);
  });

  it('excludes archived companies by default', async () => {
    const tenant = await createTestTenant();
    const ctx = ctxFor(tenant.organization.id, tenant.adminUser.id);
    await prisma.company.create({
      data: {
        organizationId: tenant.organization.id,
        name: 'Archived Co',
        nameNormalized: normalizeCompanyName('Archived Co')!,
        archivedAt: new Date(),
      },
    });

    const matches = await findDuplicateCompanies(ctx, normalizeCompanyName('Archived Co'));
    expect(matches).toEqual([]);
  });

  it('excludes the record itself via excludeId', async () => {
    const tenant = await createTestTenant();
    const ctx = ctxFor(tenant.organization.id, tenant.adminUser.id);
    const existing = await prisma.company.create({
      data: {
        organizationId: tenant.organization.id,
        name: 'Self Co',
        nameNormalized: normalizeCompanyName('Self Co')!,
      },
    });

    const matches = await findDuplicateCompanies(ctx, normalizeCompanyName('Self Co'), {
      excludeId: existing.id,
    });
    expect(matches).toEqual([]);
  });

  it('never matches across organisations', async () => {
    const [orgA, orgB] = await createTwoTestTenants();
    await prisma.company.create({
      data: {
        organizationId: orgB.organization.id,
        name: 'Shared Name Co',
        nameNormalized: normalizeCompanyName('Shared Name Co')!,
      },
    });

    const matches = await findDuplicateCompanies(
      ctxFor(orgA.organization.id, orgA.adminUser.id),
      normalizeCompanyName('Shared Name Co'),
    );
    expect(matches).toEqual([]);
  });

  it('returns no matches for a null normalised name', async () => {
    const tenant = await createTestTenant();
    const matches = await findDuplicateCompanies(ctxFor(tenant.organization.id, tenant.adminUser.id), null);
    expect(matches).toEqual([]);
  });
});

describe('findDuplicateContacts', () => {
  it('matches on normalised email or phone independently', async () => {
    const tenant = await createTestTenant();
    const ctx = ctxFor(tenant.organization.id, tenant.adminUser.id);
    const byEmail = await prisma.contact.create({
      data: {
        organizationId: tenant.organization.id,
        firstName: 'Asha',
        email: 'Asha@Example.com',
        emailNormalized: normalizeEmail('Asha@Example.com'),
      },
    });
    const byPhone = await prisma.contact.create({
      data: {
        organizationId: tenant.organization.id,
        firstName: 'Ravi',
        phone: '+91 98765 43210',
        phoneNormalized: normalizePhone('+91 98765 43210'),
      },
    });

    const matches = await findDuplicateContacts(ctx, {
      emailNormalized: normalizeEmail('asha@example.com'),
      phoneNormalized: normalizePhone('+919876543210'),
    });

    expect(matches).toHaveLength(2);
    expect(matches).toContainEqual({ id: byEmail.id, reason: 'email' });
    expect(matches).toContainEqual({ id: byPhone.id, reason: 'phone' });
  });

  it('returns no matches when neither field is provided', async () => {
    const tenant = await createTestTenant();
    const matches = await findDuplicateContacts(ctxFor(tenant.organization.id, tenant.adminUser.id), {
      emailNormalized: null,
      phoneNormalized: null,
    });
    expect(matches).toEqual([]);
  });
});

describe('findDuplicateLeads', () => {
  it('matches on email, phone, or company name, prioritising email as the reason', async () => {
    const tenant = await createTestTenant();
    const ctx = ctxFor(tenant.organization.id, tenant.adminUser.id);
    const existing = await prisma.lead.create({
      data: {
        organizationId: tenant.organization.id,
        firstName: 'Priya',
        sourceId: tenant.leadSource.id,
        email: 'priya@example.com',
        emailNormalized: normalizeEmail('priya@example.com'),
        phone: '9876543210',
        phoneNormalized: normalizePhone('9876543210'),
        companyName: 'Priya Textiles',
        companyNameNormalized: normalizeCompanyName('Priya Textiles'),
      },
    });

    const matches = await findDuplicateLeads(ctx, {
      emailNormalized: normalizeEmail('priya@example.com'),
      phoneNormalized: normalizePhone('9876543210'),
      companyNameNormalized: null,
    });

    expect(matches).toEqual([{ id: existing.id, reason: 'email' }]);
  });

  it('matches purely on company name when email/phone differ', async () => {
    const tenant = await createTestTenant();
    const ctx = ctxFor(tenant.organization.id, tenant.adminUser.id);
    const existing = await prisma.lead.create({
      data: {
        organizationId: tenant.organization.id,
        firstName: 'Deepak',
        sourceId: tenant.leadSource.id,
        email: 'deepak@example.com',
        emailNormalized: normalizeEmail('deepak@example.com'),
        companyName: 'Acme Corp Inc',
        companyNameNormalized: normalizeCompanyName('Acme Corp Inc'),
      },
    });

    const matches = await findDuplicateLeads(ctx, {
      emailNormalized: normalizeEmail('someone-else@example.com'),
      phoneNormalized: null,
      companyNameNormalized: normalizeCompanyName('ACME'),
    });

    expect(matches).toEqual([{ id: existing.id, reason: 'companyName' }]);
  });

  it('archived leads are excluded unless asked for', async () => {
    const tenant = await createTestTenant();
    const ctx = ctxFor(tenant.organization.id, tenant.adminUser.id);
    const existing = await prisma.lead.create({
      data: {
        organizationId: tenant.organization.id,
        firstName: 'Old',
        sourceId: tenant.leadSource.id,
        email: 'old@example.com',
        emailNormalized: normalizeEmail('old@example.com'),
        archivedAt: new Date(),
      },
    });

    const hiddenByDefault = await findDuplicateLeads(ctx, {
      emailNormalized: normalizeEmail('old@example.com'),
      phoneNormalized: null,
      companyNameNormalized: null,
    });
    expect(hiddenByDefault).toEqual([]);

    const shownWhenAsked = await findDuplicateLeads(
      ctx,
      {
        emailNormalized: normalizeEmail('old@example.com'),
        phoneNormalized: null,
        companyNameNormalized: null,
      },
      { includeArchived: true },
    );
    expect(shownWhenAsked).toEqual([{ id: existing.id, reason: 'email' }]);
  });
});
