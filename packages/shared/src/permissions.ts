import { ROLES } from './roles.js';

/**
 * Every permission string a route can require. Flat `resource:action` strings
 * rather than an enum, so a new permission is a one-line addition here with
 * no knock-on type changes.
 */
export const PERMISSIONS = {
  LEADS_READ: 'leads:read',
  LEADS_WRITE: 'leads:write',
  COMPANIES_READ: 'companies:read',
  COMPANIES_WRITE: 'companies:write',
  CONTACTS_READ: 'contacts:read',
  CONTACTS_WRITE: 'contacts:write',
  DEALS_READ: 'deals:read',
  DEALS_WRITE: 'deals:write',
  QUOTATIONS_READ: 'quotations:read',
  QUOTATIONS_WRITE: 'quotations:write',
  ACTIVITIES_READ: 'activities:read',
  ACTIVITIES_WRITE: 'activities:write',
  RECORDS_ARCHIVE: 'records:archive',
  DASHBOARD_READ: 'dashboard:read',
  REPORTS_READ: 'reports:read',
  REPORTS_EXPORT: 'reports:export',
  USERS_MANAGE: 'users:manage',
  AUDIT_READ: 'audit:read',
  SETTINGS_MANAGE: 'settings:manage',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const ALL_PERMISSIONS: readonly Permission[] = Object.values(PERMISSIONS);

/** Admin-only permissions per the brief's role/permission table. */
const ADMIN_ONLY_PERMISSIONS: readonly Permission[] = [
  PERMISSIONS.USERS_MANAGE,
  PERMISSIONS.AUDIT_READ,
  PERMISSIONS.SETTINGS_MANAGE,
];

export const ROLE_PERMISSIONS: Readonly<Record<ROLES, readonly Permission[]>> = {
  [ROLES.ADMIN]: ALL_PERMISSIONS,
  [ROLES.STAFF]: ALL_PERMISSIONS.filter((permission) => !ADMIN_ONLY_PERMISSIONS.includes(permission)),
};

export function hasPermission(role: ROLES, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
