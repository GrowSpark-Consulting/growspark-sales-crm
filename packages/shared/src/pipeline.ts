import { z } from 'zod';

export const stageTypeSchema = z.enum(['OPEN', 'WON', 'LOST']);
export type StageType = z.infer<typeof stageTypeSchema>;

export const pipelineStageResponseSchema = z.object({
  id: z.string(),
  pipelineId: z.string(),
  name: z.string(),
  position: z.number(),
  probability: z.number(),
  type: stageTypeSchema,
});
export type PipelineStageResponse = z.infer<typeof pipelineStageResponseSchema>;

export const pipelineStagesListResponseSchema = z.object({ data: z.array(pipelineStageResponseSchema) });

const pipelineSummaryTotalsSchema = z.object({
  count: z.number(),
  totalValue: z.string(),
  weightedValue: z.string(),
});

export const pipelineSummaryStageSchema = pipelineSummaryTotalsSchema.extend({
  stageId: z.string(),
  name: z.string(),
  position: z.number(),
  type: stageTypeSchema,
});
export type PipelineSummaryStage = z.infer<typeof pipelineSummaryStageSchema>;

export const pipelineSummaryResponseSchema = z.object({
  data: z.object({
    stages: z.array(pipelineSummaryStageSchema),
    open: pipelineSummaryTotalsSchema,
  }),
});
export type PipelineSummaryResponse = z.infer<typeof pipelineSummaryResponseSchema>;
