import type { Application } from 'express';
import {
  idParamSchema,
  listNotificationsQuerySchema,
  notificationResponseSchema,
  notificationsListResponseSchema,
  unreadNotificationsCountResponseSchema,
  markAllNotificationsReadResponseSchema,
  type IdParam,
  type ListNotificationsQuery,
} from '@growspark/shared';
import { defineRoute } from '../../lib/route-registry.js';
import * as notificationsService from './notifications.service.js';

/**
 * Notifications are personal: any signed-in user may read and mark their own,
 * so these routes need a session but no specific permission (D89). The
 * service scopes every query by organisation AND user.
 */
export function registerNotificationsRoutes(app: Application): void {
  defineRoute({
    app,
    method: 'get',
    path: '/api/v1/notifications',
    auth: 'authenticated',
    validate: { query: listNotificationsQuerySchema },
    handler: async (req, res, next) => {
      try {
        const result = await notificationsService.listNotifications(req.ctx!, req.validatedQuery as ListNotificationsQuery);
        res.status(200).json(notificationsListResponseSchema.parse(result));
      } catch (err) {
        next(err);
      }
    },
  });

  // Registered before /:id/read for clarity; the paths cannot collide anyway.
  defineRoute({
    app,
    method: 'get',
    path: '/api/v1/notifications/unread-count',
    auth: 'authenticated',
    handler: async (req, res, next) => {
      try {
        const unread = await notificationsService.getUnreadCount(req.ctx!);
        res.status(200).json(unreadNotificationsCountResponseSchema.parse({ data: { unread } }));
      } catch (err) {
        next(err);
      }
    },
  });

  defineRoute({
    app,
    method: 'post',
    path: '/api/v1/notifications/read-all',
    auth: 'authenticated',
    handler: async (req, res, next) => {
      try {
        const updated = await notificationsService.markAllNotificationsRead(req.ctx!);
        res.status(200).json(markAllNotificationsReadResponseSchema.parse({ data: { updated } }));
      } catch (err) {
        next(err);
      }
    },
  });

  defineRoute({
    app,
    method: 'post',
    path: '/api/v1/notifications/:id/read',
    auth: 'authenticated',
    validate: { params: idParamSchema },
    handler: async (req, res, next) => {
      try {
        const { id } = req.params as unknown as IdParam;
        const notification = await notificationsService.markNotificationRead(req.ctx!, id);
        res.status(200).json({ data: notificationResponseSchema.parse(notification) });
      } catch (err) {
        next(err);
      }
    },
  });
}
