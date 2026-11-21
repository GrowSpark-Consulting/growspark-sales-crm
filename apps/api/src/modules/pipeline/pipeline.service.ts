import type { PipelineStageResponse, PipelineSummaryResponse } from '@growspark/shared';
import { prisma } from '../../db/prisma.js';
import { Prisma } from '../../generated/prisma/client.js';
import { getDefaultPipeline } from '../../lib/pipeline.js';
import type { RequestContext } from '../../lib/context.js';

export async function listPipelineStages(ctx: RequestContext): Promise<PipelineStageResponse[]> {
  const pipeline = await getDefaultPipeline(prisma, ctx.orgId);
  const stages = await prisma.pipelineStage.findMany({
    where: { organizationId: ctx.orgId, pipelineId: pipeline.id },
    orderBy: { position: 'asc' },
  });
  return stages.map((stage) => ({
    id: stage.id,
    pipelineId: stage.pipelineId,
    name: stage.name,
    position: stage.position,
    probability: stage.probability,
    type: stage.type,
  }));
}

interface StageSummaryRow {
  stage_id: string;
  name: string;
  position: number;
  type: 'OPEN' | 'WON' | 'LOST';
  count: number;
  total_value: string | number;
  weighted_value: string | number;
}

interface OpenTotalsRow {
  count: number;
  total_value: string | number | null;
  weighted_value: string | number | null;
}

/**
 * All arithmetic (SUM, the weighted-value multiplication) happens in
 * Postgres over NUMERIC columns, never in JS over floats — per the brief.
 * The per-stage breakdown covers every stage (OPEN, WON, and LOST alike,
 * so a Kanban board can show totals on every column); "open" is a separate
 * aggregate across only OPEN-status, non-archived deals.
 */
export async function getPipelineSummary(ctx: RequestContext, ownerId?: string): Promise<PipelineSummaryResponse['data']> {
  const pipeline = await getDefaultPipeline(prisma, ctx.orgId);
  const ownerFilter = ownerId ? Prisma.sql`AND d.owner_id = ${ownerId}::uuid` : Prisma.empty;

  const stageRows = await prisma.$queryRaw<StageSummaryRow[]>`
    SELECT
      ps.id AS stage_id,
      ps.name AS name,
      ps.position AS position,
      ps.type AS type,
      COUNT(d.id)::int AS count,
      COALESCE(SUM(d.value), 0)::numeric(14,2) AS total_value,
      COALESCE(SUM(d.value * d.probability / 100.0), 0)::numeric(14,2) AS weighted_value
    FROM pipeline_stages ps
    LEFT JOIN deals d
      ON d.stage_id = ps.id
      AND d.organization_id = ps.organization_id
      AND d.archived_at IS NULL
      ${ownerFilter}
    WHERE ps.organization_id = ${ctx.orgId}::uuid AND ps.pipeline_id = ${pipeline.id}::uuid
    GROUP BY ps.id, ps.name, ps.position, ps.type
    ORDER BY ps.position ASC
  `;

  const [openRow] = await prisma.$queryRaw<OpenTotalsRow[]>`
    SELECT
      COUNT(*)::int AS count,
      COALESCE(SUM(value), 0)::numeric(14,2) AS total_value,
      COALESCE(SUM(value * probability / 100.0), 0)::numeric(14,2) AS weighted_value
    FROM deals
    WHERE organization_id = ${ctx.orgId}::uuid
      AND pipeline_id = ${pipeline.id}::uuid
      AND status = 'OPEN'::deal_status
      AND archived_at IS NULL
      ${ownerId ? Prisma.sql`AND owner_id = ${ownerId}::uuid` : Prisma.empty}
  `;

  return {
    stages: stageRows.map((row) => ({
      stageId: row.stage_id,
      name: row.name,
      position: row.position,
      type: row.type,
      count: row.count,
      totalValue: String(row.total_value),
      weightedValue: String(row.weighted_value),
    })),
    open: {
      count: openRow?.count ?? 0,
      totalValue: String(openRow?.total_value ?? 0),
      weightedValue: String(openRow?.weighted_value ?? 0),
    },
  };
}
