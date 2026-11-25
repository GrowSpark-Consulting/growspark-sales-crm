import type { Application } from 'express';
import { searchQuerySchema, searchResponseSchema, type SearchQuery } from '@growspark/shared';
import { defineRoute } from '../../lib/route-registry.js';
import * as searchService from './search.service.js';

/**
 * Any signed-in user (the approved plan, same as Notifications, D90). The
 * real gate is inside the service: each record type is searched only if the
 * caller's role has that type's read permission (D94).
 */
export function registerSearchRoutes(app: Application): void {
  defineRoute({
    app,
    method: 'get',
    path: '/api/v1/search',
    auth: 'authenticated',
    validate: { query: searchQuerySchema },
    handler: async (req, res, next) => {
      try {
        const { q } = req.validatedQuery as SearchQuery;
        const data = await searchService.search(req.ctx!, q);
        res.status(200).json(searchResponseSchema.parse({ data }));
      } catch (err) {
        next(err);
      }
    },
  });
}
