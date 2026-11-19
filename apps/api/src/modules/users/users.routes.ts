import type { Application } from 'express';
import {
  PERMISSIONS,
  idParamSchema,
  createUserSchema,
  updateUserSchema,
  resetUserPasswordSchema,
  listUsersQuerySchema,
  userResponseSchema,
  usersListResponseSchema,
  userOptionsListResponseSchema,
  type IdParam,
  type CreateUserInput,
  type UpdateUserInput,
  type ResetUserPasswordInput,
  type ListUsersQuery,
} from '@growspark/shared';
import { defineRoute } from '../../lib/route-registry.js';
import * as usersService from './users.service.js';

export function registerUsersRoutes(app: Application): void {
  defineRoute({
    app,
    method: 'get',
    path: '/api/v1/users',
    auth: PERMISSIONS.USERS_MANAGE,
    validate: { query: listUsersQuerySchema },
    handler: async (req, res, next) => {
      try {
        const result = await usersService.listUsers(req.ctx!, req.validatedQuery as ListUsersQuery);
        res.status(200).json(usersListResponseSchema.parse(result));
      } catch (err) {
        next(err);
      }
    },
  });

  defineRoute({
    app,
    method: 'post',
    path: '/api/v1/users',
    auth: PERMISSIONS.USERS_MANAGE,
    validate: { body: createUserSchema },
    handler: async (req, res, next) => {
      try {
        const user = await usersService.createUser(req.ctx!, req.body as CreateUserInput);
        res.status(201).json({ data: userResponseSchema.parse(user) });
      } catch (err) {
        next(err);
      }
    },
  });

  // Registered before /api/v1/users/:id — Express matches routes in
  // registration order, and "options" would otherwise be captured as :id.
  defineRoute({
    app,
    method: 'get',
    path: '/api/v1/users/options',
    auth: 'authenticated',
    handler: async (req, res, next) => {
      try {
        const data = await usersService.listActiveUserOptions(req.ctx!);
        res.status(200).json(userOptionsListResponseSchema.parse({ data }));
      } catch (err) {
        next(err);
      }
    },
  });

  defineRoute({
    app,
    method: 'get',
    path: '/api/v1/users/:id',
    auth: PERMISSIONS.USERS_MANAGE,
    validate: { params: idParamSchema },
    handler: async (req, res, next) => {
      try {
        const { id } = req.params as unknown as IdParam;
        const user = await usersService.getUser(req.ctx!, id);
        res.status(200).json({ data: userResponseSchema.parse(user) });
      } catch (err) {
        next(err);
      }
    },
  });

  defineRoute({
    app,
    method: 'patch',
    path: '/api/v1/users/:id',
    auth: PERMISSIONS.USERS_MANAGE,
    validate: { params: idParamSchema, body: updateUserSchema },
    handler: async (req, res, next) => {
      try {
        const { id } = req.params as unknown as IdParam;
        const user = await usersService.updateUser(req.ctx!, id, req.body as UpdateUserInput);
        res.status(200).json({ data: userResponseSchema.parse(user) });
      } catch (err) {
        next(err);
      }
    },
  });

  defineRoute({
    app,
    method: 'post',
    path: '/api/v1/users/:id/deactivate',
    auth: PERMISSIONS.USERS_MANAGE,
    validate: { params: idParamSchema },
    handler: async (req, res, next) => {
      try {
        const { id } = req.params as unknown as IdParam;
        const user = await usersService.deactivateUser(req.ctx!, id);
        res.status(200).json({ data: userResponseSchema.parse(user) });
      } catch (err) {
        next(err);
      }
    },
  });

  defineRoute({
    app,
    method: 'post',
    path: '/api/v1/users/:id/reactivate',
    auth: PERMISSIONS.USERS_MANAGE,
    validate: { params: idParamSchema },
    handler: async (req, res, next) => {
      try {
        const { id } = req.params as unknown as IdParam;
        const user = await usersService.reactivateUser(req.ctx!, id);
        res.status(200).json({ data: userResponseSchema.parse(user) });
      } catch (err) {
        next(err);
      }
    },
  });

  defineRoute({
    app,
    method: 'post',
    path: '/api/v1/users/:id/reset-password',
    auth: PERMISSIONS.USERS_MANAGE,
    validate: { params: idParamSchema, body: resetUserPasswordSchema },
    handler: async (req, res, next) => {
      try {
        const { id } = req.params as unknown as IdParam;
        const { newPassword } = req.body as ResetUserPasswordInput;
        await usersService.resetUserPassword(req.ctx!, id, newPassword);
        res.status(204).end();
      } catch (err) {
        next(err);
      }
    },
  });
}
