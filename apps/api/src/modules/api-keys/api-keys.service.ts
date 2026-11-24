import type { CreateApiKeyInput, ListApiKeysQuery, ApiKeyResponse } from '@growspark/shared';
import { prisma } from '../../db/prisma.js';
import { ApiError } from '../../middleware/error-handler.js';
import { scoped } from '../../lib/scoped.js';
import { writeAudit } from '../../lib/audit.js';
import { toSkipTake, buildPaginationMeta } from '../../lib/pagination.js';
import { generateApiKey, hashApiKey } from '../../lib/api-key.js';
import type { RequestContext } from '../../lib/context.js';
import type { ApiKey } from '../../generated/prisma/client.js';

function toApiKeyResponse(apiKey: ApiKey): ApiKeyResponse {
  return {
    id: apiKey.id,
    name: apiKey.name,
    keyPrefix: apiKey.keyPrefix,
    revokedAt: apiKey.revokedAt ? apiKey.revokedAt.toISOString() : null,
    lastUsedAt: apiKey.lastUsedAt ? apiKey.lastUsedAt.toISOString() : null,
    createdById: apiKey.createdById,
    createdAt: apiKey.createdAt.toISOString(),
    updatedAt: apiKey.updatedAt.toISOString(),
  };
}

export interface ListApiKeysResult {
  data: ApiKeyResponse[];
  meta: { page: number; pageSize: number; total: number };
}

/** Never returns a hash or the raw key — keyPrefix only, same as the real list endpoint. */
export async function listApiKeys(ctx: RequestContext, query: ListApiKeysQuery): Promise<ListApiKeysResult> {
  const where = { ...scoped(ctx) };
  const [rows, total] = await Promise.all([
    prisma.apiKey.findMany({ where, orderBy: { createdAt: 'desc' }, ...toSkipTake(query) }),
    prisma.apiKey.count({ where }),
  ]);
  return { data: rows.map(toApiKeyResponse), meta: buildPaginationMeta(query, total) };
}

export interface CreatedApiKeyResult {
  data: ApiKeyResponse & { key: string };
}

/** The raw key is returned here exactly once — only its hash is ever stored (D71). */
export async function createApiKey(ctx: RequestContext, input: CreateApiKeyInput): Promise<CreatedApiKeyResult> {
  const generated = generateApiKey();
  const apiKey = await prisma.$transaction(async (tx) => {
    const created = await tx.apiKey.create({
      data: {
        organizationId: ctx.orgId,
        name: input.name,
        keyPrefix: generated.keyPrefix,
        keyHash: hashApiKey(generated.key),
        createdById: ctx.userId,
      },
    });
    await writeAudit(tx, ctx, {
      action: 'apiKey.created',
      entityType: 'apiKey',
      entityId: created.id,
      metadata: { name: created.name, keyPrefix: created.keyPrefix },
    });
    return created;
  });

  return { data: { ...toApiKeyResponse(apiKey), key: generated.key } };
}

export async function revokeApiKey(ctx: RequestContext, id: string): Promise<ApiKeyResponse> {
  const revoked = await prisma.$transaction(async (tx) => {
    const existing = await tx.apiKey.findFirst({ where: { id, ...scoped(ctx) } });
    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', 'API key not found');
    }
    if (existing.revokedAt) {
      throw new ApiError(409, 'ALREADY_REVOKED', 'This API key is already revoked.');
    }
    const apiKey = await tx.apiKey.update({ where: { id: existing.id }, data: { revokedAt: new Date() } });
    await writeAudit(tx, ctx, {
      action: 'apiKey.revoked',
      entityType: 'apiKey',
      entityId: apiKey.id,
      metadata: { keyPrefix: apiKey.keyPrefix },
    });
    return apiKey;
  });
  return toApiKeyResponse(revoked);
}

/**
 * Revoke-old-plus-create-new in one transaction (D71), so a rotated key
 * stops working on its very next use, immediately — never a window where
 * both the old and new key are simultaneously valid. The new key keeps the
 * old key's name (a rotation is the same logical key getting a new value,
 * not a new one).
 */
export async function rotateApiKey(ctx: RequestContext, id: string): Promise<CreatedApiKeyResult> {
  const generated = generateApiKey();
  const created = await prisma.$transaction(async (tx) => {
    const existing = await tx.apiKey.findFirst({ where: { id, ...scoped(ctx) } });
    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', 'API key not found');
    }
    if (existing.revokedAt) {
      throw new ApiError(409, 'ALREADY_REVOKED', 'This API key is already revoked.');
    }

    await tx.apiKey.update({ where: { id: existing.id }, data: { revokedAt: new Date() } });
    const newApiKey = await tx.apiKey.create({
      data: {
        organizationId: ctx.orgId,
        name: existing.name,
        keyPrefix: generated.keyPrefix,
        keyHash: hashApiKey(generated.key),
        createdById: ctx.userId,
      },
    });
    await writeAudit(tx, ctx, {
      action: 'apiKey.rotated',
      entityType: 'apiKey',
      entityId: newApiKey.id,
      metadata: {
        previousApiKeyId: existing.id,
        previousKeyPrefix: existing.keyPrefix,
        keyPrefix: newApiKey.keyPrefix,
      },
    });
    return newApiKey;
  });

  return { data: { ...toApiKeyResponse(created), key: generated.key } };
}
