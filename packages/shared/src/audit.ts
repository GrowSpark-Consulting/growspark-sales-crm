import { z } from 'zod';
import { pageQuerySchema, paginationMetaSchema } from './common.js';

export const listAuditEventsQuerySchema = pageQuerySchema.extend({
  action: z.string().trim().min(1).optional(),
  entityType: z.string().trim().min(1).optional(),
  actorId: z.uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
export type ListAuditEventsQuery = z.infer<typeof listAuditEventsQuerySchema>;

export const auditEventResponseSchema = z.object({
  id: z.string(),
  actorId: z.string().nullable(),
  action: z.string(),
  entityType: z.string(),
  entityId: z.string().nullable(),
  metadata: z.unknown().nullable(),
  createdAt: z.string(),
});
export type AuditEventResponse = z.infer<typeof auditEventResponseSchema>;

export const auditEventsListResponseSchema = z.object({
  data: z.array(auditEventResponseSchema),
  meta: paginationMetaSchema,
});
