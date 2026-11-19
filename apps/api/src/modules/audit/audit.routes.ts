import type { Application } from 'express';
import {
  PERMISSIONS,
  listAuditEventsQuerySchema,
  auditEventsListResponseSchema,
  type ListAuditEventsQuery,
} from '@growspark/shared';
import { defineRoute } from '../../lib/route-registry.js';
import * as auditService from './audit.service.js';

export function registerAuditRoutes(app: Application): void {
  defineRoute({
    app,
    method: 'get',
    path: '/api/v1/audit-events',
    auth: PERMISSIONS.AUDIT_READ,
    validate: { query: listAuditEventsQuerySchema },
    handler: async (req, res, next) => {
      try {
        const result = await auditService.listAuditEvents(
          req.ctx!,
          req.validatedQuery as ListAuditEventsQuery,
        );
        res.status(200).json(auditEventsListResponseSchema.parse(result));
      } catch (err) {
        next(err);
      }
    },
  });
}
