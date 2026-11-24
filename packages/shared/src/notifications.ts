import { z } from 'zod';
import { booleanQueryParam, pageQuerySchema, paginationMetaSchema } from './common.js';

export const NOTIFICATION_TYPES = [
  'LEAD_ASSIGNED',
  'DEAL_ASSIGNED',
  'TASK_DUE_TODAY',
  'TASK_OVERDUE',
  'NEW_ENQUIRY',
  'QUOTATION_ACCEPTED',
  'QUOTATION_REJECTED',
] as const;
export const notificationTypeSchema = z.enum(NOTIFICATION_TYPES);
export type NotificationType = z.infer<typeof notificationTypeSchema>;

export const listNotificationsQuerySchema = pageQuerySchema.extend({
  unreadOnly: booleanQueryParam.optional(),
});
export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;

/**
 * `title` and `href` are built by the server when the list is read, from the
 * record the notification points at — the notifications table itself holds
 * no text or personal data (D89).
 */
export const notificationResponseSchema = z.object({
  id: z.string(),
  type: notificationTypeSchema,
  title: z.string(),
  href: z.string(),
  readAt: z.string().nullable(),
  createdAt: z.string(),
});
export type NotificationResponse = z.infer<typeof notificationResponseSchema>;

export const notificationsListResponseSchema = z.object({
  data: z.array(notificationResponseSchema),
  meta: paginationMetaSchema.extend({ unread: z.number() }),
});
export type NotificationsListResponse = z.infer<typeof notificationsListResponseSchema>;

export const unreadNotificationsCountResponseSchema = z.object({
  data: z.object({ unread: z.number() }),
});

export const markAllNotificationsReadResponseSchema = z.object({
  data: z.object({ updated: z.number() }),
});
