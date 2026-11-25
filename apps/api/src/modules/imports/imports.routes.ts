import type { Application } from 'express';
import {
  PERMISSIONS,
  importRequestSchema,
  importPreviewResponseSchema,
  importCommitResponseSchema,
  type ImportEntity,
  type ImportRequest,
  type Permission,
} from '@growspark/shared';
import { defineRoute } from '../../lib/route-registry.js';
import * as importsService from './imports.service.js';

/**
 * The import routes' JSON body limit. The CSV itself is capped at 1 MB of
 * UTF-8 (checked by the service); JSON escaping (quotes, line breaks) can
 * roughly double that in the request body. Every other route keeps the
 * global 100 KB limit (app.ts).
 */
export const IMPORT_JSON_BODY_LIMIT = '3mb';
export const IMPORT_PATH_PREFIX = '/api/v1/imports/';

/**
 * One set of routes per record type, so each declares its own permission
 * (D95): leads:write for leads, contacts:write for contacts. Both roles hold
 * both today.
 */
const ENTITY_PERMISSIONS: Record<ImportEntity, Permission> = {
  leads: PERMISSIONS.LEADS_WRITE,
  contacts: PERMISSIONS.CONTACTS_WRITE,
};

export function registerImportsRoutes(app: Application): void {
  for (const [entity, auth] of Object.entries(ENTITY_PERMISSIONS) as [ImportEntity, Permission][]) {
    defineRoute({
      app,
      method: 'get',
      path: `${IMPORT_PATH_PREFIX}${entity}/template`,
      auth,
      handler: (_req, res) => {
        res
          .status(200)
          .set('Content-Type', 'text/csv; charset=utf-8')
          .set('Content-Disposition', `attachment; filename="${entity}-import-template.csv"`)
          .send(importsService.buildTemplateCsv(entity));
      },
    });

    defineRoute({
      app,
      method: 'post',
      path: `${IMPORT_PATH_PREFIX}${entity}/preview`,
      auth,
      validate: { body: importRequestSchema },
      handler: async (req, res, next) => {
        try {
          const { csv, mapping } = req.body as ImportRequest;
          const data = await importsService.previewImport(req.ctx!, entity, csv, mapping);
          res.status(200).json(importPreviewResponseSchema.parse({ data }));
        } catch (err) {
          next(err);
        }
      },
    });

    defineRoute({
      app,
      method: 'post',
      path: `${IMPORT_PATH_PREFIX}${entity}/commit`,
      auth,
      validate: { body: importRequestSchema },
      handler: async (req, res, next) => {
        try {
          const { csv, mapping } = req.body as ImportRequest;
          const data = await importsService.commitImport(req.ctx!, entity, csv, mapping);
          res.status(200).json(importCommitResponseSchema.parse({ data }));
        } catch (err) {
          next(err);
        }
      },
    });
  }
}
