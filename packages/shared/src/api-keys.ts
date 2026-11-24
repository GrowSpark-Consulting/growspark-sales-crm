import { z } from 'zod';
import { pageQuerySchema, paginationMetaSchema } from './common.js';

export const createApiKeySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200, 'Name is too long'),
});
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;

export const listApiKeysQuerySchema = pageQuerySchema;
export type ListApiKeysQuery = z.infer<typeof listApiKeysQuerySchema>;

export const apiKeyResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  keyPrefix: z.string(),
  revokedAt: z.string().nullable(),
  lastUsedAt: z.string().nullable(),
  createdById: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ApiKeyResponse = z.infer<typeof apiKeyResponseSchema>;

export const apiKeysListResponseSchema = z.object({
  data: z.array(apiKeyResponseSchema),
  meta: paginationMetaSchema,
});

/**
 * The raw key value is only ever present in this response shape — returned
 * once, at creation or rotation time, and never again (only its hash is
 * stored; `GET /api-keys` returns apiKeyResponseSchema rows, with no `key`
 * field at all).
 */
export const apiKeyCreatedResponseSchema = z.object({
  data: apiKeyResponseSchema.extend({ key: z.string() }),
});
export type ApiKeyCreatedResponse = z.infer<typeof apiKeyCreatedResponseSchema>;
