import type { Application } from 'express';
import {
  PERMISSIONS,
  idParamSchema,
  createQuotationSchema,
  updateQuotationSchema,
  calculateQuotationSchema,
  changeQuotationStatusSchema,
  listQuotationsQuerySchema,
  quotationResponseSchema,
  quotationsListResponseSchema,
  quotationTotalsSchema,
  type IdParam,
  type CreateQuotationInput,
  type UpdateQuotationInput,
  type CalculateQuotationInput,
  type ChangeQuotationStatusInput,
  type ListQuotationsQuery,
} from '@growspark/shared';
import { defineRoute } from '../../lib/route-registry.js';
import { buildQuotationPdfModel, renderQuotationPdf } from '../../lib/quotation-pdf.js';
import * as quotationsService from './quotations.service.js';

export function registerQuotationsRoutes(app: Application): void {
  defineRoute({
    app,
    method: 'get',
    path: '/api/v1/quotations',
    auth: PERMISSIONS.QUOTATIONS_READ,
    validate: { query: listQuotationsQuerySchema },
    handler: async (req, res, next) => {
      try {
        const result = await quotationsService.listQuotations(req.ctx!, req.validatedQuery as ListQuotationsQuery);
        res.status(200).json(quotationsListResponseSchema.parse(result));
      } catch (err) {
        next(err);
      }
    },
  });

  defineRoute({
    app,
    method: 'post',
    path: '/api/v1/quotations',
    auth: PERMISSIONS.QUOTATIONS_WRITE,
    validate: { body: createQuotationSchema },
    handler: async (req, res, next) => {
      try {
        const quotation = await quotationsService.createQuotation(req.ctx!, req.body as CreateQuotationInput);
        res.status(201).json({ data: quotationResponseSchema.parse(quotation) });
      } catch (err) {
        next(err);
      }
    },
  });

  // The quotation form's live totals: the same server-side money rule as
  // create/update, without saving anything (D85 — no money arithmetic in
  // the frontend). Registered before the /:id routes for clarity.
  defineRoute({
    app,
    method: 'post',
    path: '/api/v1/quotations/calculate',
    auth: PERMISSIONS.QUOTATIONS_WRITE,
    validate: { body: calculateQuotationSchema },
    handler: (req, res, next) => {
      try {
        const totals = quotationsService.calculateTotals(req.body as CalculateQuotationInput);
        res.status(200).json({ data: quotationTotalsSchema.parse(totals) });
      } catch (err) {
        next(err);
      }
    },
  });

  defineRoute({
    app,
    method: 'get',
    path: '/api/v1/quotations/:id',
    auth: PERMISSIONS.QUOTATIONS_READ,
    validate: { params: idParamSchema },
    handler: async (req, res, next) => {
      try {
        const { id } = req.params as unknown as IdParam;
        const quotation = await quotationsService.getQuotation(req.ctx!, id);
        res.status(200).json({ data: quotationResponseSchema.parse(quotation) });
      } catch (err) {
        next(err);
      }
    },
  });

  defineRoute({
    app,
    method: 'patch',
    path: '/api/v1/quotations/:id',
    auth: PERMISSIONS.QUOTATIONS_WRITE,
    validate: { params: idParamSchema, body: updateQuotationSchema },
    handler: async (req, res, next) => {
      try {
        const { id } = req.params as unknown as IdParam;
        const quotation = await quotationsService.updateQuotation(req.ctx!, id, req.body as UpdateQuotationInput);
        res.status(200).json({ data: quotationResponseSchema.parse(quotation) });
      } catch (err) {
        next(err);
      }
    },
  });

  defineRoute({
    app,
    method: 'post',
    path: '/api/v1/quotations/:id/status',
    auth: PERMISSIONS.QUOTATIONS_WRITE,
    validate: { params: idParamSchema, body: changeQuotationStatusSchema },
    handler: async (req, res, next) => {
      try {
        const { id } = req.params as unknown as IdParam;
        const { quotation } = await quotationsService.changeQuotationStatus(req.ctx!, id, req.body as ChangeQuotationStatusInput);
        res.status(200).json({ data: quotationResponseSchema.parse(quotation) });
      } catch (err) {
        next(err);
      }
    },
  });

  defineRoute({
    app,
    method: 'post',
    path: '/api/v1/quotations/:id/duplicate',
    auth: PERMISSIONS.QUOTATIONS_WRITE,
    validate: { params: idParamSchema },
    handler: async (req, res, next) => {
      try {
        const { id } = req.params as unknown as IdParam;
        const quotation = await quotationsService.duplicateQuotation(req.ctx!, id);
        res.status(201).json({ data: quotationResponseSchema.parse(quotation) });
      } catch (err) {
        next(err);
      }
    },
  });

  defineRoute({
    app,
    method: 'post',
    path: '/api/v1/quotations/:id/archive',
    auth: PERMISSIONS.RECORDS_ARCHIVE,
    validate: { params: idParamSchema },
    handler: async (req, res, next) => {
      try {
        const { id } = req.params as unknown as IdParam;
        const quotation = await quotationsService.archiveQuotation(req.ctx!, id);
        res.status(200).json({ data: quotationResponseSchema.parse(quotation) });
      } catch (err) {
        next(err);
      }
    },
  });

  defineRoute({
    app,
    method: 'post',
    path: '/api/v1/quotations/:id/restore',
    auth: PERMISSIONS.RECORDS_ARCHIVE,
    validate: { params: idParamSchema },
    handler: async (req, res, next) => {
      try {
        const { id } = req.params as unknown as IdParam;
        const quotation = await quotationsService.restoreQuotation(req.ctx!, id);
        res.status(200).json({ data: quotationResponseSchema.parse(quotation) });
      } catch (err) {
        next(err);
      }
    },
  });

  defineRoute({
    app,
    method: 'get',
    path: '/api/v1/quotations/:id/pdf',
    auth: PERMISSIONS.QUOTATIONS_READ,
    validate: { params: idParamSchema },
    handler: async (req, res, next) => {
      try {
        const { id } = req.params as unknown as IdParam;
        const input = await quotationsService.getQuotationForPdf(req.ctx!, id);
        const model = buildQuotationPdfModel(input);
        const pdf = await renderQuotationPdf(model);
        res
          .status(200)
          .set('Content-Type', 'application/pdf')
          .set('Content-Disposition', `attachment; filename="${model.reference}.pdf"`)
          .set('Cache-Control', 'no-store')
          .send(pdf);
      } catch (err) {
        next(err);
      }
    },
  });
}
