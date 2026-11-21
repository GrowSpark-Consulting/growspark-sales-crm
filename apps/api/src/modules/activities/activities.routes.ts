import type { Application } from 'express';
import {
  PERMISSIONS, idParamSchema, createActivitySchema, updateActivitySchema,
  listActivitiesQuerySchema, activitiesListResponseSchema,
  activityResponseEnvelopeSchema, timelineQuerySchema, timelineResponseSchema,
  type IdParam, type CreateActivityInput, type UpdateActivityInput, type ListActivitiesQuery,
} from '@growspark/shared';
import { defineRoute } from '../../lib/route-registry.js';
import * as service from './activities.service.js';
import type { TimelineOwner } from './activities.service.js';

export function registerActivitiesRoutes(app: Application): void {
  defineRoute({ app, method: 'get', path: '/api/v1/activities', auth: PERMISSIONS.ACTIVITIES_READ, validate: { query: listActivitiesQuerySchema }, handler: async (req, res, next) => {
    try { res.status(200).json(activitiesListResponseSchema.parse(await service.listActivities(req.ctx!, req.validatedQuery as ListActivitiesQuery))); } catch (error) { next(error); }
  } });
  defineRoute({ app, method: 'post', path: '/api/v1/activities', auth: PERMISSIONS.ACTIVITIES_WRITE, validate: { body: createActivitySchema }, handler: async (req, res, next) => {
    try { res.status(201).json(activityResponseEnvelopeSchema.parse({ data: await service.createActivity(req.ctx!, req.body as CreateActivityInput) })); } catch (error) { next(error); }
  } });
  defineRoute({ app, method: 'get', path: '/api/v1/activities/:id', auth: PERMISSIONS.ACTIVITIES_READ, validate: { params: idParamSchema }, handler: async (req, res, next) => {
    try { const { id } = req.params as unknown as IdParam; res.status(200).json(activityResponseEnvelopeSchema.parse({ data: await service.getActivity(req.ctx!, id) })); } catch (error) { next(error); }
  } });
  defineRoute({ app, method: 'patch', path: '/api/v1/activities/:id', auth: PERMISSIONS.ACTIVITIES_WRITE, validate: { params: idParamSchema, body: updateActivitySchema }, handler: async (req, res, next) => {
    try { const { id } = req.params as unknown as IdParam; res.status(200).json(activityResponseEnvelopeSchema.parse({ data: await service.updateActivity(req.ctx!, id, req.body as UpdateActivityInput) })); } catch (error) { next(error); }
  } });
  for (const action of ['complete', 'cancel'] as const) {
    defineRoute({ app, method: 'post', path: `/api/v1/activities/:id/${action}`, auth: PERMISSIONS.ACTIVITIES_WRITE, validate: { params: idParamSchema }, handler: async (req, res, next) => {
      try { const { id } = req.params as unknown as IdParam; const data = action === 'complete' ? await service.completeActivity(req.ctx!, id) : await service.cancelActivity(req.ctx!, id); res.status(200).json(activityResponseEnvelopeSchema.parse({ data })); } catch (error) { next(error); }
    } });
  }
  for (const owner of ['leads', 'contacts', 'companies', 'deals'] as const) {
    const singular = { leads: 'lead', contacts: 'contact', companies: 'company', deals: 'deal' }[owner] as TimelineOwner;
    defineRoute({ app, method: 'get', path: `/api/v1/${owner}/:id/timeline`, auth: PERMISSIONS.ACTIVITIES_READ, validate: { params: idParamSchema, query: timelineQuerySchema }, handler: async (req, res, next) => {
      try { const { id } = req.params as unknown as IdParam; const query = req.validatedQuery as { page: number; pageSize: number }; res.status(200).json(timelineResponseSchema.parse(await service.getTimeline(req.ctx!, singular, id, query.page, query.pageSize))); } catch (error) { next(error); }
    } });
  }
}
