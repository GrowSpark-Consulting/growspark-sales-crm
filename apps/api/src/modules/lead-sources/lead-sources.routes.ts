import type { Application } from 'express';
import { PERMISSIONS, leadSourcesListResponseSchema, listLeadSourcesQuerySchema, type ListLeadSourcesQuery } from '@growspark/shared';
import { defineRoute } from '../../lib/route-registry.js';
import * as leadSourcesService from './lead-sources.service.js';

export function registerLeadSourcesRoutes(app: Application): void {
  defineRoute({
    app,
    method: 'get',
    path: '/api/v1/lead-sources',
    auth: PERMISSIONS.LEADS_READ,
    validate: { query: listLeadSourcesQuerySchema },
    handler: async (req, res, next) => {
      try {
        const query = req.validatedQuery as ListLeadSourcesQuery;
        const data = await leadSourcesService.listLeadSourcesForPicker(req.ctx!, query.includeInactive ?? false);
        res.status(200).json(leadSourcesListResponseSchema.parse({ data }));
      } catch (err) {
        next(err);
      }
    },
  });
}
