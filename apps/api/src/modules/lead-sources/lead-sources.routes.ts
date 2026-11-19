import type { Application } from 'express';
import { PERMISSIONS, leadSourcesListResponseSchema } from '@growspark/shared';
import { defineRoute } from '../../lib/route-registry.js';
import * as leadSourcesService from './lead-sources.service.js';

export function registerLeadSourcesRoutes(app: Application): void {
  defineRoute({
    app,
    method: 'get',
    path: '/api/v1/lead-sources',
    auth: PERMISSIONS.LEADS_READ,
    handler: async (req, res, next) => {
      try {
        const data = await leadSourcesService.listActiveLeadSources(req.ctx!);
        res.status(200).json(leadSourcesListResponseSchema.parse({ data }));
      } catch (err) {
        next(err);
      }
    },
  });
}
