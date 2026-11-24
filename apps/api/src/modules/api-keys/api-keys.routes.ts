import type { Application } from 'express';
import {
  PERMISSIONS,
  idParamSchema,
  createApiKeySchema,
  listApiKeysQuerySchema,
  apiKeyResponseSchema,
  apiKeysListResponseSchema,
  apiKeyCreatedResponseSchema,
  type IdParam,
  type CreateApiKeyInput,
  type ListApiKeysQuery,
} from '@growspark/shared';
import { defineRoute } from '../../lib/route-registry.js';
import * as apiKeysService from './api-keys.service.js';

/** Admin only — "manage settings and API keys" (the original roadmap's own role table). */
export function registerApiKeysRoutes(app: Application): void {
  defineRoute({
    app,
    method: 'get',
    path: '/api/v1/api-keys',
    auth: PERMISSIONS.SETTINGS_MANAGE,
    validate: { query: listApiKeysQuerySchema },
    handler: async (req, res, next) => {
      try {
        const result = await apiKeysService.listApiKeys(req.ctx!, req.validatedQuery as ListApiKeysQuery);
        res.status(200).json(apiKeysListResponseSchema.parse(result));
      } catch (err) {
        next(err);
      }
    },
  });

  defineRoute({
    app,
    method: 'post',
    path: '/api/v1/api-keys',
    auth: PERMISSIONS.SETTINGS_MANAGE,
    validate: { body: createApiKeySchema },
    handler: async (req, res, next) => {
      try {
        const result = await apiKeysService.createApiKey(req.ctx!, req.body as CreateApiKeyInput);
        res.status(201).json(apiKeyCreatedResponseSchema.parse(result));
      } catch (err) {
        next(err);
      }
    },
  });

  defineRoute({
    app,
    method: 'post',
    path: '/api/v1/api-keys/:id/revoke',
    auth: PERMISSIONS.SETTINGS_MANAGE,
    validate: { params: idParamSchema },
    handler: async (req, res, next) => {
      try {
        const { id } = req.params as unknown as IdParam;
        const apiKey = await apiKeysService.revokeApiKey(req.ctx!, id);
        res.status(200).json({ data: apiKeyResponseSchema.parse(apiKey) });
      } catch (err) {
        next(err);
      }
    },
  });

  defineRoute({
    app,
    method: 'post',
    path: '/api/v1/api-keys/:id/rotate',
    auth: PERMISSIONS.SETTINGS_MANAGE,
    validate: { params: idParamSchema },
    handler: async (req, res, next) => {
      try {
        const { id } = req.params as unknown as IdParam;
        const result = await apiKeysService.rotateApiKey(req.ctx!, id);
        res.status(200).json(apiKeyCreatedResponseSchema.parse(result));
      } catch (err) {
        next(err);
      }
    },
  });
}
