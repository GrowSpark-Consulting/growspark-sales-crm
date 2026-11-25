import type { Application, RequestHandler } from 'express';
import {
  PERMISSIONS,
  idParamSchema,
  updateOrganizationSchema,
  organizationResponseEnvelopeSchema,
  createLeadSourceSchema,
  updateLeadSourceSchema,
  reorderSchema,
  settingsLeadSourcesListResponseSchema,
  settingsLeadSourceEnvelopeSchema,
  createPipelineStageSchema,
  updatePipelineStageSchema,
  settingsPipelineStagesListResponseSchema,
  type IdParam,
  type UpdateOrganizationInput,
  type CreateLeadSourceInput,
  type UpdateLeadSourceInput,
  type ReorderInput,
  type CreatePipelineStageInput,
  type UpdatePipelineStageInput,
} from '@growspark/shared';
import { defineRoute } from '../../lib/route-registry.js';
import * as settingsService from './settings.service.js';

/** Wraps an async handler so every route below shares one try/catch → next(err). */
function handle(fn: (...args: Parameters<RequestHandler>) => Promise<void>): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

/** Admin only (settings:manage) — organisation profile, lead sources, pipeline stages (D93). */
export function registerSettingsRoutes(app: Application): void {
  const auth = PERMISSIONS.SETTINGS_MANAGE;

  // Organisation profile ----------------------------------------------------
  defineRoute({
    app,
    method: 'get',
    path: '/api/v1/settings/organization',
    auth,
    handler: handle(async (req, res) => {
      const data = await settingsService.getOrganization(req.ctx!);
      res.status(200).json(organizationResponseEnvelopeSchema.parse({ data }));
    }),
  });

  defineRoute({
    app,
    method: 'patch',
    path: '/api/v1/settings/organization',
    auth,
    validate: { body: updateOrganizationSchema },
    handler: handle(async (req, res) => {
      const data = await settingsService.updateOrganization(req.ctx!, req.body as UpdateOrganizationInput);
      res.status(200).json(organizationResponseEnvelopeSchema.parse({ data }));
    }),
  });

  // Lead sources ------------------------------------------------------------
  defineRoute({
    app,
    method: 'get',
    path: '/api/v1/settings/lead-sources',
    auth,
    handler: handle(async (req, res) => {
      const data = await settingsService.listLeadSources(req.ctx!);
      res.status(200).json(settingsLeadSourcesListResponseSchema.parse({ data }));
    }),
  });

  defineRoute({
    app,
    method: 'post',
    path: '/api/v1/settings/lead-sources',
    auth,
    validate: { body: createLeadSourceSchema },
    handler: handle(async (req, res) => {
      const data = await settingsService.createLeadSource(req.ctx!, req.body as CreateLeadSourceInput);
      res.status(201).json(settingsLeadSourceEnvelopeSchema.parse({ data }));
    }),
  });

  // Declared before /:id so "order" is never read as an id.
  defineRoute({
    app,
    method: 'put',
    path: '/api/v1/settings/lead-sources/order',
    auth,
    validate: { body: reorderSchema },
    handler: handle(async (req, res) => {
      const data = await settingsService.reorderLeadSources(req.ctx!, req.body as ReorderInput);
      res.status(200).json(settingsLeadSourcesListResponseSchema.parse({ data }));
    }),
  });

  defineRoute({
    app,
    method: 'patch',
    path: '/api/v1/settings/lead-sources/:id',
    auth,
    validate: { params: idParamSchema, body: updateLeadSourceSchema },
    handler: handle(async (req, res) => {
      const { id } = req.params as unknown as IdParam;
      const data = await settingsService.updateLeadSource(req.ctx!, id, req.body as UpdateLeadSourceInput);
      res.status(200).json(settingsLeadSourceEnvelopeSchema.parse({ data }));
    }),
  });

  // Pipeline stages ---------------------------------------------------------
  // Every stage write returns the whole, renumbered list.
  defineRoute({
    app,
    method: 'get',
    path: '/api/v1/settings/pipeline-stages',
    auth,
    handler: handle(async (req, res) => {
      const data = await settingsService.listPipelineStages(req.ctx!);
      res.status(200).json(settingsPipelineStagesListResponseSchema.parse({ data }));
    }),
  });

  defineRoute({
    app,
    method: 'post',
    path: '/api/v1/settings/pipeline-stages',
    auth,
    validate: { body: createPipelineStageSchema },
    handler: handle(async (req, res) => {
      const data = await settingsService.createPipelineStage(req.ctx!, req.body as CreatePipelineStageInput);
      res.status(201).json(settingsPipelineStagesListResponseSchema.parse({ data }));
    }),
  });

  defineRoute({
    app,
    method: 'put',
    path: '/api/v1/settings/pipeline-stages/order',
    auth,
    validate: { body: reorderSchema },
    handler: handle(async (req, res) => {
      const data = await settingsService.reorderPipelineStages(req.ctx!, req.body as ReorderInput);
      res.status(200).json(settingsPipelineStagesListResponseSchema.parse({ data }));
    }),
  });

  defineRoute({
    app,
    method: 'patch',
    path: '/api/v1/settings/pipeline-stages/:id',
    auth,
    validate: { params: idParamSchema, body: updatePipelineStageSchema },
    handler: handle(async (req, res) => {
      const { id } = req.params as unknown as IdParam;
      const data = await settingsService.updatePipelineStage(req.ctx!, id, req.body as UpdatePipelineStageInput);
      res.status(200).json(settingsPipelineStagesListResponseSchema.parse({ data }));
    }),
  });

  defineRoute({
    app,
    method: 'delete',
    path: '/api/v1/settings/pipeline-stages/:id',
    auth,
    validate: { params: idParamSchema },
    handler: handle(async (req, res) => {
      const { id } = req.params as unknown as IdParam;
      const data = await settingsService.deletePipelineStage(req.ctx!, id);
      res.status(200).json(settingsPipelineStagesListResponseSchema.parse({ data }));
    }),
  });
}
