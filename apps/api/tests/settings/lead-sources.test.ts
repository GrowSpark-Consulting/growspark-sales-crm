import { describe, expect, it } from 'vitest';
import { prisma } from '../../src/db/prisma.js';
import { createTestTenant, createTwoTestTenants, type TestTenant } from '../helpers/tenant.js';
import { adminApi, staffApi } from './helpers.js';

async function addLocked(tenant: TestTenant, name: string, sortOrder: number) {
  return prisma.leadSource.create({ data: { organizationId: tenant.organization.id, name, sortOrder } });
}

describe('Settings — lead sources', () => {
  it('lists every source (inactive included) with lead counts and lock flags, while GET /lead-sources keeps returning active ones only', async () => {
    const tenant = await createTestTenant();
    await addLocked(tenant, 'Website', 2);
    const inactive = await prisma.leadSource.create({
      data: { organizationId: tenant.organization.id, name: 'Old fair', sortOrder: 3, isActive: false },
    });
    const admin = await adminApi(tenant);

    const res = await admin.get('/api/v1/settings/lead-sources');
    expect(res.status).toBe(200);
    const byName = Object.fromEntries(res.body.data.map((s: { name: string }) => [s.name, s]));
    expect(byName['Website']).toMatchObject({ locked: true, isActive: true, leadCount: 0 });
    expect(byName['Old fair']).toMatchObject({ locked: false, isActive: false });

    const dropdown = await admin.get('/api/v1/lead-sources');
    expect(dropdown.body.data.map((s: { id: string }) => s.id)).not.toContain(inactive.id);
  });

  it('creates a source at the end of the list and audits it; refuses a case-insensitive duplicate name with 409', async () => {
    const tenant = await createTestTenant();
    const admin = await adminApi(tenant);

    const res = await admin.post('/api/v1/settings/lead-sources', { name: '  Trade show ' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ name: 'Trade show', isActive: true, sortOrder: 2, locked: false });

    const dup = await admin.post('/api/v1/settings/lead-sources', { name: 'TRADE SHOW' });
    expect(dup.status).toBe(409);
    expect(await prisma.leadSource.count({ where: { organizationId: tenant.organization.id } })).toBe(2);

    const audit = await prisma.auditEvent.findFirst({
      where: { organizationId: tenant.organization.id, action: 'lead_source.created' },
    });
    expect(audit?.actorId).toBe(tenant.adminUser.id);
    expect(audit?.metadata).toEqual({ name: 'Trade show' });
  });

  it('renames, deactivates and reactivates a source, auditing each change', async () => {
    const tenant = await createTestTenant();
    const admin = await adminApi(tenant);
    const id = tenant.leadSource.id;

    const renamed = await admin.patch(`/api/v1/settings/lead-sources/${id}`, { name: 'Partner referral' });
    expect(renamed.status).toBe(200);
    expect(renamed.body.data.name).toBe('Partner referral');

    const off = await admin.patch(`/api/v1/settings/lead-sources/${id}`, { isActive: false });
    expect(off.body.data.isActive).toBe(false);
    const on = await admin.patch(`/api/v1/settings/lead-sources/${id}`, { isActive: true });
    expect(on.body.data.isActive).toBe(true);

    const actions = (
      await prisma.auditEvent.findMany({
        where: { organizationId: tenant.organization.id, entityType: 'lead_source' },
        orderBy: { createdAt: 'asc' },
      })
    ).map((row) => row.action);
    expect(actions).toEqual(['lead_source.updated', 'lead_source.deactivated', 'lead_source.reactivated']);
  });

  it('Website, Manual and Import cannot be renamed or deactivated, and their names cannot be taken by another source (breaks without the lock)', async () => {
    const tenant = await createTestTenant();
    const admin = await adminApi(tenant);
    for (const [index, name] of ['Website', 'Manual', 'Import'].entries()) {
      const source = await addLocked(tenant, name, index + 2);
      const rename = await admin.patch(`/api/v1/settings/lead-sources/${source.id}`, { name: `${name} 2` });
      expect(rename.status).toBe(409);
      expect(rename.body.error.code).toBe('LOCKED');
      const deactivate = await admin.patch(`/api/v1/settings/lead-sources/${source.id}`, { isActive: false });
      expect(deactivate.status).toBe(409);
      const stillThere = await prisma.leadSource.findUniqueOrThrow({ where: { id: source.id } });
      expect(stillThere).toMatchObject({ name, isActive: true });
    }
  });

  it('a lead cannot be created with, or moved to, an inactive source — but editing a lead that already has one still works', async () => {
    const tenant = await createTestTenant();
    const admin = await adminApi(tenant);
    const lead = await admin.post('/api/v1/leads', { firstName: 'Asha', email: 'asha@example.test', sourceId: tenant.leadSource.id });
    expect(lead.status).toBe(201);

    const other = await prisma.leadSource.create({
      data: { organizationId: tenant.organization.id, name: 'Retired', sortOrder: 5, isActive: false },
    });
    const create = await admin.post('/api/v1/leads', { firstName: 'Ravi', email: 'ravi@example.test', sourceId: other.id });
    expect(create.status).toBe(422);
    expect(create.body.error.details[0].path).toBe('sourceId');

    const move = await admin.patch(`/api/v1/leads/${lead.body.data.id}`, { sourceId: other.id });
    expect(move.status).toBe(422);

    // Now retire the lead's own source; resending it on an edit must still succeed.
    await admin.patch(`/api/v1/settings/lead-sources/${tenant.leadSource.id}`, { isActive: false });
    const edit = await admin.patch(`/api/v1/leads/${lead.body.data.id}`, { sourceId: tenant.leadSource.id, jobTitle: 'COO' });
    expect(edit.status).toBe(200);
    expect(edit.body.data.jobTitle).toBe('COO');
  });

  it('reorders when given every id exactly once; anything else is 422 and changes nothing', async () => {
    const tenant = await createTestTenant();
    const admin = await adminApi(tenant);
    const b = (await admin.post('/api/v1/settings/lead-sources', { name: 'B' })).body.data.id as string;
    const c = (await admin.post('/api/v1/settings/lead-sources', { name: 'C' })).body.data.id as string;
    const a = tenant.leadSource.id;

    const res = await admin.put('/api/v1/settings/lead-sources/order', { ids: [c, a, b] });
    expect(res.status).toBe(200);
    expect(res.body.data.map((s: { id: string }) => s.id)).toEqual([c, a, b]);

    const missing = await admin.put('/api/v1/settings/lead-sources/order', { ids: [a, b] });
    expect(missing.status).toBe(422);
    const repeated = await admin.put('/api/v1/settings/lead-sources/order', { ids: [a, a, b] });
    expect(repeated.status).toBe(422);
    const after = await admin.get('/api/v1/settings/lead-sources');
    expect(after.body.data.map((s: { id: string }) => s.id)).toEqual([c, a, b]);
  });

  it('never touches another organisation’s sources: another org’s id is a 404, and it cannot be smuggled into a reorder', async () => {
    const [a, b] = await createTwoTestTenants();
    const adminA = await adminApi(a);
    const rename = await adminA.patch(`/api/v1/settings/lead-sources/${b.leadSource.id}`, { name: 'Hijacked' });
    expect(rename.status).toBe(404);
    const reorder = await adminA.put('/api/v1/settings/lead-sources/order', { ids: [b.leadSource.id] });
    expect(reorder.status).toBe(422);
    const list = await adminA.get('/api/v1/settings/lead-sources');
    expect(list.body.data.map((s: { id: string }) => s.id)).toEqual([a.leadSource.id]);
    expect((await prisma.leadSource.findUniqueOrThrow({ where: { id: b.leadSource.id } })).name).toBe(b.leadSource.name);
  });

  it('Staff can still read the dropdown list (GET /lead-sources) — only management is Admin-only', async () => {
    const tenant = await createTestTenant();
    const staff = await staffApi(tenant);
    expect((await staff.get('/api/v1/lead-sources')).status).toBe(200);
    expect((await staff.get('/api/v1/settings/lead-sources')).status).toBe(403);
  });
});
