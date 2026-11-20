import type { Pipeline, PipelineStage, Prisma, PrismaClient } from '../generated/prisma/client.js';
import { ApiError } from '../middleware/error-handler.js';

type Db = Prisma.TransactionClient | PrismaClient;

/**
 * One pipeline per organisation in the MVP (the roadmap: "Support one
 * configurable pipeline initially"). Prefers the one marked `isDefault`,
 * falling back to any pipeline for the org so this still works if that flag
 * is ever missing — every real organisation has exactly one, from the seed.
 */
export async function getDefaultPipeline(db: Db, organizationId: string): Promise<Pipeline> {
  const pipeline =
    (await db.pipeline.findFirst({ where: { organizationId, isDefault: true } })) ??
    (await db.pipeline.findFirst({ where: { organizationId } }));
  if (!pipeline) {
    throw new ApiError(500, 'INTERNAL', 'No pipeline is configured for this organisation.');
  }
  return pipeline;
}

/** The stage a new deal (or a reopened one) starts in: the lowest-position OPEN-type stage. */
export async function getFirstOpenStage(db: Db, organizationId: string, pipelineId: string): Promise<PipelineStage> {
  const stage = await db.pipelineStage.findFirst({
    where: { organizationId, pipelineId, type: 'OPEN' },
    orderBy: { position: 'asc' },
  });
  if (!stage) {
    throw new ApiError(500, 'INTERNAL', 'No open pipeline stage is configured for this organisation.');
  }
  return stage;
}
