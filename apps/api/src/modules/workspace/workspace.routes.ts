import type { Application } from 'express';
import { PERMISSIONS, todayQuerySchema, dashboardQuerySchema, todayResponseSchema, dashboardResponseSchema, type TodayQuery, type DashboardQuery } from '@growspark/shared';
import { defineRoute } from '../../lib/route-registry.js';
import * as service from './workspace.service.js';

export function registerWorkspaceRoutes(app: Application): void {
  defineRoute({ app, method: 'get', path: '/api/v1/today', auth: PERMISSIONS.ACTIVITIES_READ, validate: { query: todayQuerySchema }, handler: async (req, res, next) => {
    try { res.status(200).json(todayResponseSchema.parse(await service.getToday(req.ctx!, req.validatedQuery as TodayQuery))); } catch (error) { next(error); }
  } });
  defineRoute({ app, method: 'get', path: '/api/v1/dashboard', auth: PERMISSIONS.DASHBOARD_READ, validate: { query: dashboardQuerySchema }, handler: async (req, res, next) => {
    try { res.status(200).json(dashboardResponseSchema.parse(await service.getDashboard(req.ctx!, req.validatedQuery as DashboardQuery))); } catch (error) { next(error); }
  } });
}
