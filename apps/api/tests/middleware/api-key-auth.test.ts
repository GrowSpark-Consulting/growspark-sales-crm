import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { ROLES } from '@growspark/shared';
import { attachApiKeyContext } from '../../src/middleware/api-key-auth.js';
import { errorHandler } from '../../src/middleware/error-handler.js';
import { requestId } from '../../src/middleware/request-id.js';
import { createTestTenant } from '../helpers/tenant.js';
import * as apiKeysService from '../../src/modules/api-keys/api-keys.service.js';
import { prisma } from '../../src/db/prisma.js';
import type { RequestContext } from '../../src/lib/context.js';

/**
 * Tests attachApiKeyContext directly, the same way csrf.test.ts tests
 * enforceOriginAndContentType directly — independent of app.ts's own
 * global mount. The real intake route proves the full chain end to end
 * (tests/intake), including the D71 Origin-exemption scenarios.
 */
function buildApp() {
  const app = express();
  app.use(requestId);
  app.use(attachApiKeyContext);
  app.get('/x', (req, res) => res.json({ apiKeyCtx: req.apiKeyCtx }));
  app.use(errorHandler);
  return app;
}

async function createTenantAndKey(name = 'Website intake') {
  const tenant = await createTestTenant();
  const ctx: RequestContext = { userId: tenant.adminUser.id, orgId: tenant.organization.id, role: ROLES.ADMIN };
  const created = await apiKeysService.createApiKey(ctx, { name });
  return { tenant, ctx, key: created.data.key, apiKeyId: created.data.id, keyPrefix: created.data.keyPrefix };
}

describe('attachApiKeyContext', () => {
  it('attaches organizationId/apiKeyId/keyPrefix for a valid key, and updates lastUsedAt', async () => {
    const { tenant, key, apiKeyId, keyPrefix } = await createTenantAndKey();

    const res = await request(buildApp()).get('/x').set('Authorization', `Bearer ${key}`);
    expect(res.status).toBe(200);
    expect(res.body.apiKeyCtx).toEqual({ organizationId: tenant.organization.id, apiKeyId, keyPrefix });

    const row = await prisma.apiKey.findUniqueOrThrow({ where: { id: apiKeyId } });
    expect(row.lastUsedAt).not.toBeNull();
  });

  it('rejects a missing Authorization header (401)', async () => {
    const res = await request(buildApp()).get('/x');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects an Authorization header that is not Bearer-prefixed (401)', async () => {
    const res = await request(buildApp()).get('/x').set('Authorization', 'Basic abc123');
    expect(res.status).toBe(401);
  });

  it('rejects "Bearer " with nothing after it (401)', async () => {
    const res = await request(buildApp()).get('/x').set('Authorization', 'Bearer ');
    expect(res.status).toBe(401);
  });

  it('rejects an unknown key (401)', async () => {
    const res = await request(buildApp()).get('/x').set('Authorization', 'Bearer gsk_live_doesNotExist00000000000000000000000');
    expect(res.status).toBe(401);
  });

  it('a revoked key stops working on its very next request', async () => {
    const { ctx, key, apiKeyId } = await createTenantAndKey();
    const app = buildApp();

    const before = await request(app).get('/x').set('Authorization', `Bearer ${key}`);
    expect(before.status).toBe(200);

    await apiKeysService.revokeApiKey(ctx, apiKeyId);

    const after = await request(app).get('/x').set('Authorization', `Bearer ${key}`);
    expect(after.status).toBe(401);
  });

  it('a rotated key stops working, and the new key works, on its very next request', async () => {
    const { ctx, key, apiKeyId } = await createTenantAndKey();
    const app = buildApp();

    const rotated = await apiKeysService.rotateApiKey(ctx, apiKeyId);

    const oldKeyRes = await request(app).get('/x').set('Authorization', `Bearer ${key}`);
    expect(oldKeyRes.status).toBe(401);

    const newKeyRes = await request(app).get('/x').set('Authorization', `Bearer ${rotated.data.key}`);
    expect(newKeyRes.status).toBe(200);
  });
});
