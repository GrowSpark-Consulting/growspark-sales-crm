import type { Application } from 'express';
import {
  PERMISSIONS,
  idParamSchema,
  createDealSchema,
  updateDealSchema,
  moveDealStageSchema,
  closeDealSchema,
  setDealContactsSchema,
  listDealsQuerySchema,
  dealResponseSchema,
  dealsListResponseSchema,
  dealContactsResponseSchema,
  type IdParam,
  type CreateDealInput,
  type UpdateDealInput,
  type MoveDealStageInput,
  type CloseDealInput,
  type SetDealContactsInput,
  type ListDealsQuery,
} from '@growspark/shared';
import { defineRoute } from '../../lib/route-registry.js';
import * as dealsService from './deals.service.js';

export function registerDealsRoutes(app: Application): void {
  defineRoute({
    app,
    method: 'get',
    path: '/api/v1/deals',
    auth: PERMISSIONS.DEALS_READ,
    validate: { query: listDealsQuerySchema },
    handler: async (req, res, next) => {
      try {
        const result = await dealsService.listDeals(req.ctx!, req.validatedQuery as ListDealsQuery);
        res.status(200).json(dealsListResponseSchema.parse(result));
      } catch (err) {
        next(err);
      }
    },
  });

  defineRoute({
    app,
    method: 'post',
    path: '/api/v1/deals',
    auth: PERMISSIONS.DEALS_WRITE,
    validate: { body: createDealSchema },
    handler: async (req, res, next) => {
      try {
        const deal = await dealsService.createDeal(req.ctx!, req.body as CreateDealInput);
        res.status(201).json({ data: dealResponseSchema.parse(deal) });
      } catch (err) {
        next(err);
      }
    },
  });

  defineRoute({
    app,
    method: 'get',
    path: '/api/v1/deals/:id',
    auth: PERMISSIONS.DEALS_READ,
    validate: { params: idParamSchema },
    handler: async (req, res, next) => {
      try {
        const { id } = req.params as unknown as IdParam;
        const deal = await dealsService.getDeal(req.ctx!, id);
        res.status(200).json({ data: dealResponseSchema.parse(deal) });
      } catch (err) {
        next(err);
      }
    },
  });

  defineRoute({
    app,
    method: 'patch',
    path: '/api/v1/deals/:id',
    auth: PERMISSIONS.DEALS_WRITE,
    validate: { params: idParamSchema, body: updateDealSchema },
    handler: async (req, res, next) => {
      try {
        const { id } = req.params as unknown as IdParam;
        const deal = await dealsService.updateDeal(req.ctx!, id, req.body as UpdateDealInput);
        res.status(200).json({ data: dealResponseSchema.parse(deal) });
      } catch (err) {
        next(err);
      }
    },
  });

  defineRoute({
    app,
    method: 'post',
    path: '/api/v1/deals/:id/stage',
    auth: PERMISSIONS.DEALS_WRITE,
    validate: { params: idParamSchema, body: moveDealStageSchema },
    handler: async (req, res, next) => {
      try {
        const { id } = req.params as unknown as IdParam;
        const deal = await dealsService.moveDealStage(req.ctx!, id, req.body as MoveDealStageInput);
        res.status(200).json({ data: dealResponseSchema.parse(deal) });
      } catch (err) {
        next(err);
      }
    },
  });

  defineRoute({
    app,
    method: 'post',
    path: '/api/v1/deals/:id/close',
    auth: PERMISSIONS.DEALS_WRITE,
    validate: { params: idParamSchema, body: closeDealSchema },
    handler: async (req, res, next) => {
      try {
        const { id } = req.params as unknown as IdParam;
        const deal = await dealsService.closeDeal(req.ctx!, id, req.body as CloseDealInput);
        res.status(200).json({ data: dealResponseSchema.parse(deal) });
      } catch (err) {
        next(err);
      }
    },
  });

  defineRoute({
    app,
    method: 'post',
    path: '/api/v1/deals/:id/reopen',
    auth: PERMISSIONS.DEALS_WRITE,
    validate: { params: idParamSchema },
    handler: async (req, res, next) => {
      try {
        const { id } = req.params as unknown as IdParam;
        const deal = await dealsService.reopenDeal(req.ctx!, id);
        res.status(200).json({ data: dealResponseSchema.parse(deal) });
      } catch (err) {
        next(err);
      }
    },
  });

  defineRoute({
    app,
    method: 'post',
    path: '/api/v1/deals/:id/archive',
    auth: PERMISSIONS.RECORDS_ARCHIVE,
    validate: { params: idParamSchema },
    handler: async (req, res, next) => {
      try {
        const { id } = req.params as unknown as IdParam;
        const deal = await dealsService.archiveDeal(req.ctx!, id);
        res.status(200).json({ data: dealResponseSchema.parse(deal) });
      } catch (err) {
        next(err);
      }
    },
  });

  defineRoute({
    app,
    method: 'post',
    path: '/api/v1/deals/:id/restore',
    auth: PERMISSIONS.RECORDS_ARCHIVE,
    validate: { params: idParamSchema },
    handler: async (req, res, next) => {
      try {
        const { id } = req.params as unknown as IdParam;
        const deal = await dealsService.restoreDeal(req.ctx!, id);
        res.status(200).json({ data: dealResponseSchema.parse(deal) });
      } catch (err) {
        next(err);
      }
    },
  });

  defineRoute({
    app,
    method: 'put',
    path: '/api/v1/deals/:id/contacts',
    auth: PERMISSIONS.DEALS_WRITE,
    validate: { params: idParamSchema, body: setDealContactsSchema },
    handler: async (req, res, next) => {
      try {
        const { id } = req.params as unknown as IdParam;
        const data = await dealsService.setDealContacts(req.ctx!, id, req.body as SetDealContactsInput);
        res.status(200).json(dealContactsResponseSchema.parse({ data }));
      } catch (err) {
        next(err);
      }
    },
  });
}
