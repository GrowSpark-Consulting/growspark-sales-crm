import { describe, expect, it } from 'vitest';
import { PERMISSIONS, ROLE_PERMISSIONS, ROLES, hasPermission } from '@growspark/shared';

const ADMIN_ONLY = [PERMISSIONS.USERS_MANAGE, PERMISSIONS.AUDIT_READ, PERMISSIONS.SETTINGS_MANAGE];

describe('ROLE_PERMISSIONS', () => {
  it('gives Admin every permission', () => {
    for (const permission of Object.values(PERMISSIONS)) {
      expect(ROLE_PERMISSIONS[ROLES.ADMIN]).toContain(permission);
    }
  });

  it('gives Staff every permission except users:manage, audit:read, settings:manage', () => {
    for (const permission of ADMIN_ONLY) {
      expect(ROLE_PERMISSIONS[ROLES.STAFF]).not.toContain(permission);
    }
    for (const permission of Object.values(PERMISSIONS)) {
      if (!(ADMIN_ONLY as string[]).includes(permission)) {
        expect(ROLE_PERMISSIONS[ROLES.STAFF]).toContain(permission);
      }
    }
  });
});

describe('hasPermission', () => {
  it('matches ROLE_PERMISSIONS exactly for both roles and every permission', () => {
    for (const role of [ROLES.ADMIN, ROLES.STAFF]) {
      for (const permission of Object.values(PERMISSIONS)) {
        expect(hasPermission(role, permission)).toBe(ROLE_PERMISSIONS[role].includes(permission));
      }
    }
  });
});
