import type { Application } from 'express';
import {
  PERMISSIONS,
  reportsQuerySchema,
  reportsResponseSchema,
  reportExportParamsSchema,
  type ReportsQuery,
  type ReportExportParams,
} from '@growspark/shared';
import { defineRoute } from '../../lib/route-registry.js';
import { rowsToCsv } from '../../lib/csv.js';
import * as reportsService from './reports.service.js';

export function registerReportsRoutes(app: Application): void {
  defineRoute({
    app,
    method: 'get',
    path: '/api/v1/reports',
    auth: PERMISSIONS.REPORTS_READ,
    validate: { query: reportsQuerySchema },
    handler: async (req, res, next) => {
      try {
        const data = await reportsService.getReports(req.ctx!, req.validatedQuery as ReportsQuery);
        res.status(200).json(reportsResponseSchema.parse({ data }));
      } catch (err) {
        next(err);
      }
    },
  });

  // One CSV per report, same filters as the page. Gated on reports:export,
  // like every other CSV download in this app (D76).
  defineRoute({
    app,
    method: 'get',
    path: '/api/v1/reports/:report/export',
    auth: PERMISSIONS.REPORTS_EXPORT,
    validate: { params: reportExportParamsSchema, query: reportsQuerySchema },
    handler: async (req, res, next) => {
      try {
        const { report } = req.params as unknown as ReportExportParams;
        const csv = await reportsService.getReportCsv(req.ctx!, report, req.validatedQuery as ReportsQuery);
        res
          .status(200)
          .set('Content-Type', 'text/csv; charset=utf-8')
          .set('Content-Disposition', `attachment; filename="${csv.filename}"`)
          .send(rowsToCsv(csv.rows, csv.columns));
      } catch (err) {
        next(err);
      }
    },
  });
}
