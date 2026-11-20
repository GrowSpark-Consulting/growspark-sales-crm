import type { Application } from 'express';
import { PERMISSIONS, pipelineStagesListResponseSchema, pipelineSummaryResponseSchema } from '@growspark/shared';
import { defineRoute } from '../../lib/route-registry.js';
import * as pipelineService from './pipeline.service.js';

export function registerPipelineRoutes(app: Application): void {
  defineRoute({
    app,
    method: 'get',
    path: '/api/v1/pipeline/stages',
    auth: PERMISSIONS.DEALS_READ,
    handler: async (req, res, next) => {
      try {
        const data = await pipelineService.listPipelineStages(req.ctx!);
        res.status(200).json(pipelineStagesListResponseSchema.parse({ data }));
      } catch (err) {
        next(err);
      }
    },
  });

  defineRoute({
    app,
    method: 'get',
    path: '/api/v1/pipeline/summary',
    auth: PERMISSIONS.DEALS_READ,
    handler: async (req, res, next) => {
      try {
        const data = await pipelineService.getPipelineSummary(req.ctx!);
        res.status(200).json(pipelineSummaryResponseSchema.parse({ data }));
      } catch (err) {
        next(err);
      }
    },
  });
}
