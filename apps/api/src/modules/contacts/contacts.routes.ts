import type { Application } from 'express';
import {
  PERMISSIONS,
  idParamSchema,
  createContactSchema,
  updateContactSchema,
  listContactsQuerySchema,
  contactResponseSchema,
  contactsListResponseSchema,
  contactWithDuplicatesResponseSchema,
  type IdParam,
  type CreateContactInput,
  type UpdateContactInput,
  type ListContactsQuery,
} from '@growspark/shared';
import { defineRoute } from '../../lib/route-registry.js';
import { rowsToCsv } from '../../lib/csv.js';
import * as contactsService from './contacts.service.js';

export function registerContactsRoutes(app: Application): void {
  defineRoute({
    app,
    method: 'get',
    path: '/api/v1/contacts',
    auth: PERMISSIONS.CONTACTS_READ,
    validate: { query: listContactsQuerySchema },
    handler: async (req, res, next) => {
      try {
        const result = await contactsService.listContacts(req.ctx!, req.validatedQuery as ListContactsQuery);
        res.status(200).json(contactsListResponseSchema.parse(result));
      } catch (err) {
        next(err);
      }
    },
  });

  defineRoute({
    app,
    method: 'post',
    path: '/api/v1/contacts',
    auth: PERMISSIONS.CONTACTS_WRITE,
    validate: { body: createContactSchema },
    handler: async (req, res, next) => {
      try {
        const { contact, duplicates } = await contactsService.createContact(
          req.ctx!,
          req.body as CreateContactInput,
        );
        res.status(201).json(contactWithDuplicatesResponseSchema.parse({ data: contact, duplicates }));
      } catch (err) {
        next(err);
      }
    },
  });

  // Registered before /api/v1/contacts/:id so "export" isn't captured as :id.
  defineRoute({
    app,
    method: 'get',
    path: '/api/v1/contacts/export',
    auth: PERMISSIONS.REPORTS_EXPORT,
    validate: { query: listContactsQuerySchema },
    handler: async (req, res, next) => {
      try {
        const rows = await contactsService.exportContacts(req.ctx!, req.validatedQuery as ListContactsQuery);
        const csv = rowsToCsv(rows, contactsService.CONTACT_EXPORT_COLUMNS);
        res
          .status(200)
          .set('Content-Type', 'text/csv; charset=utf-8')
          .set(
            'Content-Disposition',
            `attachment; filename="contacts-export-${new Date().toISOString().slice(0, 10)}.csv"`,
          )
          .send(csv);
      } catch (err) {
        next(err);
      }
    },
  });

  defineRoute({
    app,
    method: 'get',
    path: '/api/v1/contacts/:id',
    auth: PERMISSIONS.CONTACTS_READ,
    validate: { params: idParamSchema },
    handler: async (req, res, next) => {
      try {
        const { id } = req.params as unknown as IdParam;
        const contact = await contactsService.getContact(req.ctx!, id);
        res.status(200).json({ data: contactResponseSchema.parse(contact) });
      } catch (err) {
        next(err);
      }
    },
  });

  defineRoute({
    app,
    method: 'patch',
    path: '/api/v1/contacts/:id',
    auth: PERMISSIONS.CONTACTS_WRITE,
    validate: { params: idParamSchema, body: updateContactSchema },
    handler: async (req, res, next) => {
      try {
        const { id } = req.params as unknown as IdParam;
        const { contact, duplicates } = await contactsService.updateContact(
          req.ctx!,
          id,
          req.body as UpdateContactInput,
        );
        res.status(200).json(contactWithDuplicatesResponseSchema.parse({ data: contact, duplicates }));
      } catch (err) {
        next(err);
      }
    },
  });

  defineRoute({
    app,
    method: 'post',
    path: '/api/v1/contacts/:id/archive',
    auth: PERMISSIONS.RECORDS_ARCHIVE,
    validate: { params: idParamSchema },
    handler: async (req, res, next) => {
      try {
        const { id } = req.params as unknown as IdParam;
        const contact = await contactsService.archiveContact(req.ctx!, id);
        res.status(200).json({ data: contactResponseSchema.parse(contact) });
      } catch (err) {
        next(err);
      }
    },
  });

  defineRoute({
    app,
    method: 'post',
    path: '/api/v1/contacts/:id/restore',
    auth: PERMISSIONS.RECORDS_ARCHIVE,
    validate: { params: idParamSchema },
    handler: async (req, res, next) => {
      try {
        const { id } = req.params as unknown as IdParam;
        const contact = await contactsService.restoreContact(req.ctx!, id);
        res.status(200).json({ data: contactResponseSchema.parse(contact) });
      } catch (err) {
        next(err);
      }
    },
  });
}
