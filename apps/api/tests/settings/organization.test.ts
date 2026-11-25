import { describe, expect, it } from 'vitest';
import { prisma } from '../../src/db/prisma.js';
import { createTestTenant, createTwoTestTenants } from '../helpers/tenant.js';
import { adminApi, staffApi } from './helpers.js';

describe('Settings — organisation profile', () => {
  it('Staff gets 403 on every settings route; Admin gets 200', async () => {
    const tenant = await createTestTenant();
    const staff = await staffApi(tenant);
    const admin = await adminApi(tenant);

    const staffResults = await Promise.all([
      staff.get('/api/v1/settings/organization'),
      staff.patch('/api/v1/settings/organization', { city: 'Chennai' }),
      staff.get('/api/v1/settings/lead-sources'),
      staff.post('/api/v1/settings/lead-sources', { name: 'Trade show' }),
      staff.put('/api/v1/settings/lead-sources/order', { ids: [tenant.leadSource.id] }),
      staff.patch(`/api/v1/settings/lead-sources/${tenant.leadSource.id}`, { name: 'X' }),
      staff.get('/api/v1/settings/pipeline-stages'),
      staff.post('/api/v1/settings/pipeline-stages', { name: 'Demo', probability: 30 }),
      staff.put('/api/v1/settings/pipeline-stages/order', { ids: [tenant.stages[0]!.id] }),
      staff.patch(`/api/v1/settings/pipeline-stages/${tenant.stages[0]!.id}`, { name: 'X' }),
      staff.delete(`/api/v1/settings/pipeline-stages/${tenant.stages[0]!.id}`),
    ]);
    for (const res of staffResults) expect(res.status).toBe(403);

    expect((await admin.get('/api/v1/settings/organization')).status).toBe(200);
    // Nothing was written by the refused requests.
    const org = await prisma.organization.findUniqueOrThrow({ where: { id: tenant.organization.id } });
    expect(org.city).toBeNull();
  });

  it('updates the profile, upper-cases the GSTIN, audits field names only (actor = the Admin), and is a no-op when unchanged', async () => {
    const tenant = await createTestTenant();
    const admin = await adminApi(tenant);

    const res = await admin.patch('/api/v1/settings/organization', {
      name: 'Example Consulting',
      legalName: 'Example Consulting Pvt Ltd',
      city: 'Chennai',
      gstin: '33abcde1234f1z5',
      email: 'accounts@example.test',
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      name: 'Example Consulting',
      legalName: 'Example Consulting Pvt Ltd',
      city: 'Chennai',
      gstin: '33ABCDE1234F1Z5',
      timezone: 'Asia/Kolkata',
      currency: 'INR',
    });

    const audits = await prisma.auditEvent.findMany({
      where: { organizationId: tenant.organization.id, action: 'organization.details_updated' },
    });
    expect(audits).toHaveLength(1);
    expect(audits[0]!.actorId).toBe(tenant.adminUser.id);
    expect(audits[0]!.metadata).toEqual({ changedFields: ['name', 'legalName', 'city', 'email', 'gstin'] });
    expect(JSON.stringify(audits[0]!.metadata)).not.toContain('Chennai');

    // Same values again → nothing changes, no second audit row.
    const again = await admin.patch('/api/v1/settings/organization', { city: 'Chennai', gstin: '33ABCDE1234F1Z5' });
    expect(again.status).toBe(200);
    expect(
      await prisma.auditEvent.count({ where: { organizationId: tenant.organization.id, action: 'organization.details_updated' } }),
    ).toBe(1);

    // "" clears a field.
    const cleared = await admin.patch('/api/v1/settings/organization', { city: '' });
    expect(cleared.body.data.city).toBeNull();
  });

  it('rejects a bad GSTIN, a bad email, a blank name, an unknown key, and refuses to change timezone/currency', async () => {
    const tenant = await createTestTenant();
    const admin = await adminApi(tenant);
    for (const body of [{ gstin: '1234' }, { email: 'nope' }, { name: '   ' }, { adress: 'x' }, { timezone: 'UTC' }, { currency: 'USD' }]) {
      const res = await admin.patch('/api/v1/settings/organization', body);
      expect(res.status, JSON.stringify(body)).toBe(422);
    }
    const org = await prisma.organization.findUniqueOrThrow({ where: { id: tenant.organization.id } });
    expect(org.timezone).toBe('Asia/Kolkata');
    expect(org.currency).toBe('INR');
  });

  it('only ever reads and writes the caller’s own organisation', async () => {
    const [a, b] = await createTwoTestTenants();
    const adminA = await adminApi(a);
    const res = await adminA.patch('/api/v1/settings/organization', { city: 'Madurai' });
    expect(res.body.data.id).toBe(a.organization.id);
    const orgB = await prisma.organization.findUniqueOrThrow({ where: { id: b.organization.id } });
    expect(orgB.city).toBeNull();
    expect((await adminA.get('/api/v1/settings/organization')).body.data.name).toBe(a.organization.name);
  });
});
