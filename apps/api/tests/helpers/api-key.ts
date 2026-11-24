import { ROLES } from '@growspark/shared';
import * as apiKeysService from '../../src/modules/api-keys/api-keys.service.js';
import type { TestTenant } from './tenant.js';
import type { RequestContext } from '../../src/lib/context.js';

/** A real, working API key for a test tenant — goes through the real createApiKey service, same hashing path production uses. */
export async function createTestApiKey(
  tenant: TestTenant,
  name = 'Website intake',
): Promise<{ key: string; apiKeyId: string; keyPrefix: string }> {
  const ctx: RequestContext = { userId: tenant.adminUser.id, orgId: tenant.organization.id, role: ROLES.ADMIN };
  const created = await apiKeysService.createApiKey(ctx, { name });
  return { key: created.data.key, apiKeyId: created.data.id, keyPrefix: created.data.keyPrefix };
}
