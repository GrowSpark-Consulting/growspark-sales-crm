import { describe, expect, it } from 'vitest';
import { prisma } from '../../src/db/prisma.js';
import { applyOrganizationDetails, organizationDetailsSchema } from '../../src/lib/organization-details.js';
import { createTestTenant } from '../helpers/tenant.js';

describe('organizationDetailsSchema', () => {
  it('accepts a partial file, upper-cases the GSTIN and turns "" into a clear', () => {
    const parsed = organizationDetailsSchema.parse({ legalName: ' Example Pvt Ltd ', gstin: '33abcde1234f1z5', website: '' });
    expect(parsed).toEqual({ legalName: 'Example Pvt Ltd', gstin: '33ABCDE1234F1Z5', website: null });
  });

  it('rejects an unknown key (a typo must not be silently ignored), a bad GSTIN and a bad email', () => {
    expect(organizationDetailsSchema.safeParse({ adress: 'x' }).success).toBe(false);
    expect(organizationDetailsSchema.safeParse({ gstin: '1234' }).success).toBe(false);
    expect(organizationDetailsSchema.safeParse({ email: 'not-an-email' }).success).toBe(false);
  });
});

describe('applyOrganizationDetails', () => {
  it('writes only the keys given, leaves the rest alone, and audits the field names as a system action', async () => {
    const tenant = await createTestTenant();
    await prisma.organization.update({ where: { id: tenant.organization.id }, data: { city: 'Chennai' } });

    const changed = await applyOrganizationDetails(prisma, tenant.organization.id, organizationDetailsSchema.parse({ legalName: 'Example Pvt Ltd', phone: '+919840012345' }));
    expect(changed).toEqual(['legalName', 'phone']);

    const organization = await prisma.organization.findUniqueOrThrow({ where: { id: tenant.organization.id } });
    expect(organization).toMatchObject({ legalName: 'Example Pvt Ltd', phone: '+919840012345', city: 'Chennai', gstin: null });

    const audit = await prisma.auditEvent.findFirstOrThrow({ where: { organizationId: tenant.organization.id, action: 'organization.details_updated' } });
    expect(audit.actorId).toBeNull();
    expect(audit.metadata).toEqual({ changedFields: ['legalName', 'phone'] });
  });

  it('does nothing for an empty file', async () => {
    const tenant = await createTestTenant();
    expect(await applyOrganizationDetails(prisma, tenant.organization.id, organizationDetailsSchema.parse({}))).toEqual([]);
    expect(await prisma.auditEvent.count({ where: { organizationId: tenant.organization.id } })).toBe(0);
  });
});
