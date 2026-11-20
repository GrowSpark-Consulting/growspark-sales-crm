import type { Application } from 'express';
import {
  PERMISSIONS,
  idParamSchema,
  createLeadSchema,
  updateLeadSchema,
  updateLeadStatusSchema,
  listLeadsQuerySchema,
  leadDuplicateCheckQuerySchema,
  leadResponseSchema,
  leadsListResponseSchema,
  leadWithDuplicatesResponseSchema,
  leadDuplicatesResponseSchema,
  leadStatusHistoryListResponseSchema,
  convertLeadSchema,
  leadConversionResponseSchema,
  leadConversionMatchesResponseSchema,
  type IdParam,
  type CreateLeadInput,
  type UpdateLeadInput,
  type UpdateLeadStatusInput,
  type ListLeadsQuery,
  type LeadDuplicateCheckQuery,
  type ConvertLeadInput,
} from '@growspark/shared';
import { defineRoute } from '../../lib/route-registry.js';
import * as leadsService from './leads.service.js';
import * as leadConversionService from './lead-conversion.service.js';

export function registerLeadsRoutes(app: Application): void {
  defineRoute({
    app,
    method: 'get',
    path: '/api/v1/leads',
    auth: PERMISSIONS.LEADS_READ,
    validate: { query: listLeadsQuerySchema },
    handler: async (req, res, next) => {
      try {
        const result = await leadsService.listLeads(req.ctx!, req.validatedQuery as ListLeadsQuery);
        res.status(200).json(leadsListResponseSchema.parse(result));
      } catch (err) {
        next(err);
      }
    },
  });

  defineRoute({
    app,
    method: 'post',
    path: '/api/v1/leads',
    auth: PERMISSIONS.LEADS_WRITE,
    validate: { body: createLeadSchema },
    handler: async (req, res, next) => {
      try {
        const { lead, duplicates } = await leadsService.createLead(req.ctx!, req.body as CreateLeadInput);
        res.status(201).json(leadWithDuplicatesResponseSchema.parse({ data: lead, duplicates }));
      } catch (err) {
        next(err);
      }
    },
  });

  // Registered before /api/v1/leads/:id — Express matches routes in
  // registration order, and "duplicates" would otherwise be captured as :id.
  defineRoute({
    app,
    method: 'get',
    path: '/api/v1/leads/duplicates',
    auth: PERMISSIONS.LEADS_READ,
    validate: { query: leadDuplicateCheckQuerySchema },
    handler: async (req, res, next) => {
      try {
        const data = await leadsService.checkLeadDuplicates(
          req.ctx!,
          req.validatedQuery as LeadDuplicateCheckQuery,
        );
        res.status(200).json(leadDuplicatesResponseSchema.parse({ data }));
      } catch (err) {
        next(err);
      }
    },
  });

  defineRoute({
    app,
    method: 'get',
    path: '/api/v1/leads/:id',
    auth: PERMISSIONS.LEADS_READ,
    validate: { params: idParamSchema },
    handler: async (req, res, next) => {
      try {
        const { id } = req.params as unknown as IdParam;
        const lead = await leadsService.getLead(req.ctx!, id);
        res.status(200).json({ data: leadResponseSchema.parse(lead) });
      } catch (err) {
        next(err);
      }
    },
  });

  defineRoute({
    app,
    method: 'patch',
    path: '/api/v1/leads/:id',
    auth: PERMISSIONS.LEADS_WRITE,
    validate: { params: idParamSchema, body: updateLeadSchema },
    handler: async (req, res, next) => {
      try {
        const { id } = req.params as unknown as IdParam;
        const { lead, duplicates } = await leadsService.updateLead(req.ctx!, id, req.body as UpdateLeadInput);
        res.status(200).json(leadWithDuplicatesResponseSchema.parse({ data: lead, duplicates }));
      } catch (err) {
        next(err);
      }
    },
  });

  defineRoute({
    app,
    method: 'post',
    path: '/api/v1/leads/:id/status',
    auth: PERMISSIONS.LEADS_WRITE,
    validate: { params: idParamSchema, body: updateLeadStatusSchema },
    handler: async (req, res, next) => {
      try {
        const { id } = req.params as unknown as IdParam;
        const lead = await leadsService.updateLeadStatus(req.ctx!, id, req.body as UpdateLeadStatusInput);
        res.status(200).json({ data: leadResponseSchema.parse(lead) });
      } catch (err) {
        next(err);
      }
    },
  });

  defineRoute({
    app,
    method: 'get',
    path: '/api/v1/leads/:id/status-history',
    auth: PERMISSIONS.LEADS_READ,
    validate: { params: idParamSchema },
    handler: async (req, res, next) => {
      try {
        const { id } = req.params as unknown as IdParam;
        const data = await leadsService.listLeadStatusHistory(req.ctx!, id);
        res.status(200).json(leadStatusHistoryListResponseSchema.parse({ data }));
      } catch (err) {
        next(err);
      }
    },
  });

  defineRoute({
    app,
    method: 'get',
    path: '/api/v1/leads/:id/conversion-matches',
    auth: PERMISSIONS.LEADS_READ,
    validate: { params: idParamSchema },
    handler: async (req, res, next) => {
      try {
        const { id } = req.params as unknown as IdParam;
        const data = await leadConversionService.getLeadConversionMatches(req.ctx!, id);
        res.status(200).json(leadConversionMatchesResponseSchema.parse({ data }));
      } catch (err) {
        next(err);
      }
    },
  });

  defineRoute({
    app,
    method: 'post',
    path: '/api/v1/leads/:id/convert',
    auth: PERMISSIONS.LEADS_WRITE,
    validate: { params: idParamSchema, body: convertLeadSchema },
    handler: async (req, res, next) => {
      try {
        const { id } = req.params as unknown as IdParam;
        const data = await leadConversionService.convertLead(req.ctx!, id, req.body as ConvertLeadInput);
        res.status(200).json(leadConversionResponseSchema.parse({ data }));
      } catch (err) {
        next(err);
      }
    },
  });

  defineRoute({
    app,
    method: 'post',
    path: '/api/v1/leads/:id/archive',
    auth: PERMISSIONS.RECORDS_ARCHIVE,
    validate: { params: idParamSchema },
    handler: async (req, res, next) => {
      try {
        const { id } = req.params as unknown as IdParam;
        const lead = await leadsService.archiveLead(req.ctx!, id);
        res.status(200).json({ data: leadResponseSchema.parse(lead) });
      } catch (err) {
        next(err);
      }
    },
  });

  defineRoute({
    app,
    method: 'post',
    path: '/api/v1/leads/:id/restore',
    auth: PERMISSIONS.RECORDS_ARCHIVE,
    validate: { params: idParamSchema },
    handler: async (req, res, next) => {
      try {
        const { id } = req.params as unknown as IdParam;
        const lead = await leadsService.restoreLead(req.ctx!, id);
        res.status(200).json({ data: leadResponseSchema.parse(lead) });
      } catch (err) {
        next(err);
      }
    },
  });
}
