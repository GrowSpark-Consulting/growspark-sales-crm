import { describe, expect, it } from 'vitest';
import { ROLES } from '@growspark/shared';
import { scoped } from '../../src/lib/scoped.js';

describe('scoped', () => {
  it('returns an organizationId filter from the context', () => {
    const ctx = { userId: 'user-1', orgId: 'org-1', role: ROLES.ADMIN };
    expect(scoped(ctx)).toEqual({ organizationId: 'org-1' });
  });

  it('uses orgId, not userId or role', () => {
    const ctx = { userId: 'org-1', orgId: 'org-2', role: ROLES.STAFF };
    expect(scoped(ctx)).toEqual({ organizationId: 'org-2' });
  });
});
