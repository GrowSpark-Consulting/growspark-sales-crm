import type { Application } from 'express';
import {
  PERMISSIONS,
  idParamSchema,
  listEnquiriesQuerySchema,
  enquiryResponseSchema,
  enquiriesListResponseSchema,
  enquiryDetailResponseSchema,
  type IdParam,
  type ListEnquiriesQuery,
} from '@growspark/shared';
import { defineRoute } from '../../lib/route-registry.js';
import * as enquiriesService from './enquiries.service.js';

/** Same visibility as Leads (LEADS_READ/LEADS_WRITE); archive/restore follows every other archivable resource's convention (RECORDS_ARCHIVE). */
export function registerEnquiriesRoutes(app: Application): void {
  defineRoute({
    app,
    method: 'get',
    path: '/api/v1/enquiries',
    auth: PERMISSIONS.LEADS_READ,
    validate: { query: listEnquiriesQuerySchema },
    handler: async (req, res, next) => {
      try {
        const result = await enquiriesService.listEnquiries(req.ctx!, req.validatedQuery as ListEnquiriesQuery);
        res.status(200).json(enquiriesListResponseSchema.parse(result));
      } catch (err) {
        next(err);
      }
    },
  });

  defineRoute({
    app,
    method: 'get',
    path: '/api/v1/enquiries/:id',
    auth: PERMISSIONS.LEADS_READ,
    validate: { params: idParamSchema },
    handler: async (req, res, next) => {
      try {
        const { id } = req.params as unknown as IdParam;
        const data = await enquiriesService.getEnquiry(req.ctx!, id);
        res.status(200).json(enquiryDetailResponseSchema.parse({ data }));
      } catch (err) {
        next(err);
      }
    },
  });

  defineRoute({
    app,
    method: 'post',
    path: '/api/v1/enquiries/:id/mark-spam',
    auth: PERMISSIONS.LEADS_WRITE,
    validate: { params: idParamSchema },
    handler: async (req, res, next) => {
      try {
        const { id } = req.params as unknown as IdParam;
        const enquiry = await enquiriesService.markEnquirySpam(req.ctx!, id);
        res.status(200).json({ data: enquiryResponseSchema.parse(enquiry) });
      } catch (err) {
        next(err);
      }
    },
  });

  defineRoute({
    app,
    method: 'post',
    path: '/api/v1/enquiries/:id/archive',
    auth: PERMISSIONS.RECORDS_ARCHIVE,
    validate: { params: idParamSchema },
    handler: async (req, res, next) => {
      try {
        const { id } = req.params as unknown as IdParam;
        const enquiry = await enquiriesService.archiveEnquiry(req.ctx!, id);
        res.status(200).json({ data: enquiryResponseSchema.parse(enquiry) });
      } catch (err) {
        next(err);
      }
    },
  });

  defineRoute({
    app,
    method: 'post',
    path: '/api/v1/enquiries/:id/restore',
    auth: PERMISSIONS.RECORDS_ARCHIVE,
    validate: { params: idParamSchema },
    handler: async (req, res, next) => {
      try {
        const { id } = req.params as unknown as IdParam;
        const enquiry = await enquiriesService.restoreEnquiry(req.ctx!, id);
        res.status(200).json({ data: enquiryResponseSchema.parse(enquiry) });
      } catch (err) {
        next(err);
      }
    },
  });
}
