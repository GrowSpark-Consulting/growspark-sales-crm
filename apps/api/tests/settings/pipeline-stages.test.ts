import { describe, expect, it } from 'vitest';
import { prisma } from '../../src/db/prisma.js';
import { createTestTenant, createTwoTestTenants, type TestTenant } from '../helpers/tenant.js';
import { adminApi } from './helpers.js';

interface StageRow {
  id: string;
  name: string;
  position: number;
  probability: number;
  type: 'OPEN' | 'WON' | 'LOST';
  dealCount: number;
  deletable: boolean;
}

async function createCompany(tenant: TestTenant) {
  return prisma.company.create({
    data: { organizationId: tenant.organization.id, name: 'Example Foods', nameNormalized: 'example foods' },
  });
}

function names(rows: StageRow[]) {
  return rows.map((row) => `${row.position}:${row.name}`);
}

describe('Settings — pipeline stages', () => {
  it('lists stages in board order with deal counts and a deletable flag', async () => {
    const tenant = await createTestTenant();
    const admin = await adminApi(tenant);
    const res = await admin.get('/api/v1/settings/pipeline-stages');
    expect(res.status).toBe(200);
    expect(names(res.body.data)).toEqual([
      '1:Qualification',
      '2:Needs Analysis',
      '3:Proposal',
      '4:Negotiation',
      '5:Won',
      '6:Lost',
    ]);
    const won = res.body.data.find((row: StageRow) => row.type === 'WON');
    expect(won.deletable).toBe(false);
    expect(res.body.data[0].deletable).toBe(true);
  });

  it('adds a new open stage after the existing open stages, keeping Won and Lost last, and audits it', async () => {
    const tenant = await createTestTenant();
    const admin = await adminApi(tenant);
    const res = await admin.post('/api/v1/settings/pipeline-stages', { name: 'Contract sent', probability: 90 });
    expect(res.status).toBe(201);
    expect(names(res.body.data)).toEqual([
      '1:Qualification',
      '2:Needs Analysis',
      '3:Proposal',
      '4:Negotiation',
      '5:Contract sent',
      '6:Won',
      '7:Lost',
    ]);
    expect(res.body.data[4]).toMatchObject({ type: 'OPEN', probability: 90 });
    expect(
      await prisma.auditEvent.count({ where: { organizationId: tenant.organization.id, action: 'pipeline_stage.created' } }),
    ).toBe(1);

    const dup = await admin.post('/api/v1/settings/pipeline-stages', { name: 'proposal', probability: 40 });
    expect(dup.status).toBe(409);
  });

  it('renames any stage and changes an open stage’s probability without rewriting existing deals; Won/Lost probability is fixed', async () => {
    const tenant = await createTestTenant();
    const admin = await adminApi(tenant);
    const company = await createCompany(tenant);
    const deal = await admin.post('/api/v1/deals', { name: 'Plant automation', companyId: company.id });
    expect(deal.status).toBe(201);
    expect(deal.body.data.probability).toBe(10);
    const qualification = tenant.stages[0]!;

    const res = await admin.patch(`/api/v1/settings/pipeline-stages/${qualification.id}`, { name: 'Discovery', probability: 15 });
    expect(res.status).toBe(200);
    expect(res.body.data[0]).toMatchObject({ name: 'Discovery', probability: 15, dealCount: 1 });

    const dealAfter = await prisma.deal.findUniqueOrThrow({ where: { id: deal.body.data.id } });
    expect(dealAfter.probability).toBe(10);

    const won = tenant.stages.find((stage) => stage.type === 'WON')!;
    const wonProbability = await admin.patch(`/api/v1/settings/pipeline-stages/${won.id}`, { probability: 90 });
    expect(wonProbability.status).toBe(422);
    const wonRename = await admin.patch(`/api/v1/settings/pipeline-stages/${won.id}`, { name: 'Closed won' });
    expect(wonRename.status).toBe(200);
    expect(wonRename.body.data.find((row: StageRow) => row.id === won.id)).toMatchObject({ name: 'Closed won', probability: 100 });

    const audit = await prisma.auditEvent.findFirst({
      where: { organizationId: tenant.organization.id, action: 'pipeline_stage.updated', entityId: qualification.id },
    });
    expect(audit?.metadata).toEqual({ changedFields: ['name', 'probability'], oldName: 'Qualification', newName: 'Discovery' });
  });

  it('reorders the open stages; Won/Lost stay last; the first open stage becomes where new deals start', async () => {
    const tenant = await createTestTenant();
    const admin = await adminApi(tenant);
    const [q, n, p, neg] = tenant.stages;
    const res = await admin.put('/api/v1/settings/pipeline-stages/order', { ids: [p!.id, q!.id, n!.id, neg!.id] });
    expect(res.status).toBe(200);
    expect(names(res.body.data)).toEqual([
      '1:Proposal',
      '2:Qualification',
      '3:Needs Analysis',
      '4:Negotiation',
      '5:Won',
      '6:Lost',
    ]);

    const company = await createCompany(tenant);
    const deal = await admin.post('/api/v1/deals', { name: 'After reorder', companyId: company.id });
    expect(deal.body.data.stageId).toBe(p!.id);

    // Including a Won/Lost id, or leaving an open stage out, is refused.
    const won = tenant.stages.find((stage) => stage.type === 'WON')!;
    expect((await admin.put('/api/v1/settings/pipeline-stages/order', { ids: [won.id, q!.id, n!.id, neg!.id] })).status).toBe(422);
    expect((await admin.put('/api/v1/settings/pipeline-stages/order', { ids: [q!.id, n!.id, neg!.id] })).status).toBe(422);
  });

  it('deletes only a never-used open stage (breaks without the in-use check), renumbers, and keeps at least one open stage', async () => {
    const tenant = await createTestTenant();
    const admin = await adminApi(tenant);
    const company = await createCompany(tenant);

    // Used by a deal (which also writes stage history) → refused, even once the deal is archived.
    const deal = await admin.post('/api/v1/deals', { name: 'In qualification', companyId: company.id });
    await admin.post(`/api/v1/deals/${deal.body.data.id}/archive`);
    const used = await admin.delete(`/api/v1/settings/pipeline-stages/${tenant.stages[0]!.id}`);
    expect(used.status).toBe(409);
    expect(used.body.error.code).toBe('STAGE_IN_USE');

    // Used only in history (deal moved on) → still refused.
    const moved = await admin.post('/api/v1/deals', { name: 'Moved on', companyId: company.id });
    await admin.post(`/api/v1/deals/${moved.body.data.id}/stage`, { stageId: tenant.stages[2]!.id });
    await admin.post(`/api/v1/deals/${moved.body.data.id}/stage`, { stageId: tenant.stages[3]!.id });
    const historyOnly = await admin.delete(`/api/v1/settings/pipeline-stages/${tenant.stages[2]!.id}`);
    expect(historyOnly.status).toBe(409);

    // Never used → deleted, positions closed up.
    const unused = await admin.delete(`/api/v1/settings/pipeline-stages/${tenant.stages[1]!.id}`);
    expect(unused.status).toBe(200);
    expect(names(unused.body.data)).toEqual(['1:Qualification', '2:Proposal', '3:Negotiation', '4:Won', '5:Lost']);
    expect(
      await prisma.auditEvent.count({ where: { organizationId: tenant.organization.id, action: 'pipeline_stage.deleted' } }),
    ).toBe(1);

    const won = tenant.stages.find((stage) => stage.type === 'WON')!;
    expect((await admin.delete(`/api/v1/settings/pipeline-stages/${won.id}`)).status).toBe(409);
  });

  it('refuses to delete the last open stage', async () => {
    const tenant = await createTestTenant();
    const admin = await adminApi(tenant);
    for (const stage of tenant.stages.slice(0, 3)) {
      expect((await admin.delete(`/api/v1/settings/pipeline-stages/${stage.id}`)).status).toBe(200);
    }
    const last = await admin.delete(`/api/v1/settings/pipeline-stages/${tenant.stages[3]!.id}`);
    expect(last.status).toBe(409);
    expect(last.body.error.message).toMatch(/at least one open stage/);
  });

  it('concurrent adds never collide on a position (the settings lock serialises them)', async () => {
    const tenant = await createTestTenant();
    const admin = await adminApi(tenant);
    const results = await Promise.all(
      ['A', 'B', 'C', 'D', 'E'].map((name) => admin.post('/api/v1/settings/pipeline-stages', { name: `Stage ${name}`, probability: 50 })),
    );
    for (const res of results) expect(res.status).toBe(201);
    const stages = await prisma.pipelineStage.findMany({
      where: { organizationId: tenant.organization.id },
      orderBy: { position: 'asc' },
    });
    expect(stages.map((stage) => stage.position)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(stages.slice(-2).map((stage) => stage.type)).toEqual(['WON', 'LOST']);
  });

  it('another organisation’s stage is a 404 for every write, and their pipeline is untouched', async () => {
    const [a, b] = await createTwoTestTenants();
    const adminA = await adminApi(a);
    const target = b.stages[1]!;
    expect((await adminA.patch(`/api/v1/settings/pipeline-stages/${target.id}`, { name: 'Hijacked' })).status).toBe(404);
    expect((await adminA.delete(`/api/v1/settings/pipeline-stages/${target.id}`)).status).toBe(404);
    expect(
      (await adminA.put('/api/v1/settings/pipeline-stages/order', { ids: b.stages.slice(0, 4).map((stage) => stage.id) })).status,
    ).toBe(422);
    const bStages = await prisma.pipelineStage.findMany({ where: { organizationId: b.organization.id }, orderBy: { position: 'asc' } });
    expect(bStages.map((stage) => stage.name)).toEqual(b.stages.map((stage) => stage.name));
  });
});
