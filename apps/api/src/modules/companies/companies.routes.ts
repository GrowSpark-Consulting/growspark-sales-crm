import type { Application } from 'express';
import {
  PERMISSIONS,
  idParamSchema,
  createCompanySchema,
  updateCompanySchema,
  listCompaniesQuerySchema,
  companyResponseSchema,
  companiesListResponseSchema,
  companyWithDuplicatesResponseSchema,
  type IdParam,
  type CreateCompanyInput,
  type UpdateCompanyInput,
  type ListCompaniesQuery,
} from '@growspark/shared';
import { defineRoute } from '../../lib/route-registry.js';
import * as companiesService from './companies.service.js';

export function registerCompaniesRoutes(app: Application): void {
  defineRoute({
    app,
    method: 'get',
    path: '/api/v1/companies',
    auth: PERMISSIONS.COMPANIES_READ,
    validate: { query: listCompaniesQuerySchema },
    handler: async (req, res, next) => {
      try {
        const result = await companiesService.listCompanies(req.ctx!, req.validatedQuery as ListCompaniesQuery);
        res.status(200).json(companiesListResponseSchema.parse(result));
      } catch (err) {
        next(err);
      }
    },
  });

  defineRoute({
    app,
    method: 'post',
    path: '/api/v1/companies',
    auth: PERMISSIONS.COMPANIES_WRITE,
    validate: { body: createCompanySchema },
    handler: async (req, res, next) => {
      try {
        const { company, duplicates } = await companiesService.createCompany(
          req.ctx!,
          req.body as CreateCompanyInput,
        );
        res
          .status(201)
          .json(companyWithDuplicatesResponseSchema.parse({ data: company, duplicates }));
      } catch (err) {
        next(err);
      }
    },
  });

  defineRoute({
    app,
    method: 'get',
    path: '/api/v1/companies/:id',
    auth: PERMISSIONS.COMPANIES_READ,
    validate: { params: idParamSchema },
    handler: async (req, res, next) => {
      try {
        const { id } = req.params as unknown as IdParam;
        const company = await companiesService.getCompany(req.ctx!, id);
        res.status(200).json({ data: companyResponseSchema.parse(company) });
      } catch (err) {
        next(err);
      }
    },
  });

  defineRoute({
    app,
    method: 'patch',
    path: '/api/v1/companies/:id',
    auth: PERMISSIONS.COMPANIES_WRITE,
    validate: { params: idParamSchema, body: updateCompanySchema },
    handler: async (req, res, next) => {
      try {
        const { id } = req.params as unknown as IdParam;
        const { company, duplicates } = await companiesService.updateCompany(
          req.ctx!,
          id,
          req.body as UpdateCompanyInput,
        );
        res.status(200).json(companyWithDuplicatesResponseSchema.parse({ data: company, duplicates }));
      } catch (err) {
        next(err);
      }
    },
  });

  defineRoute({
    app,
    method: 'post',
    path: '/api/v1/companies/:id/archive',
    auth: PERMISSIONS.RECORDS_ARCHIVE,
    validate: { params: idParamSchema },
    handler: async (req, res, next) => {
      try {
        const { id } = req.params as unknown as IdParam;
        const company = await companiesService.archiveCompany(req.ctx!, id);
        res.status(200).json({ data: companyResponseSchema.parse(company) });
      } catch (err) {
        next(err);
      }
    },
  });

  defineRoute({
    app,
    method: 'post',
    path: '/api/v1/companies/:id/restore',
    auth: PERMISSIONS.RECORDS_ARCHIVE,
    validate: { params: idParamSchema },
    handler: async (req, res, next) => {
      try {
        const { id } = req.params as unknown as IdParam;
        const company = await companiesService.restoreCompany(req.ctx!, id);
        res.status(200).json({ data: companyResponseSchema.parse(company) });
      } catch (err) {
        next(err);
      }
    },
  });
}
