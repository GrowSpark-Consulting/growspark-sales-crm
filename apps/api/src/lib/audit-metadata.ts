/**
 * An allowlist, not a denylist, for what an audit event's `metadata` JSON
 * may show through the API: every key actually written by a real
 * `writeAudit()`/`writeIntakeAudit()` call site in this codebase today
 * (verified by reading every call site, not guessed), each one already a
 * name, id, enum value, or list of field *names* — never a raw secret.
 * A denylist would let a brand-new metadata field through by default the
 * moment someone adds one and forgets to list it as dangerous; an
 * allowlist hides anything unrecognised by default instead, which is the
 * direction a mistake should fail in for an Admin-only audit screen.
 */
const ALLOWED_METADATA_KEYS = new Set([
  'type',
  'changedFields',
  'name',
  'keyPrefix',
  'previousApiKeyId',
  'previousKeyPrefix',
  'companyId',
  'contactId',
  'dealId',
  'createdCompany',
  'createdContact',
  'fromStageId',
  'toStageId',
  'lostReason',
  'reason',
  'firstName',
  'lastName',
  'sourceId',
  'fromStatus',
  'toStatus',
  'email',
  'role',
  'oldName',
  'newName',
  'oldRole',
  'newRole',
  'contactIds',
  'submissionId',
  'apiKeyPrefix',
]);

/**
 * Drops any metadata key not on the allowlist above. Never throws — an
 * audit screen must keep working even if a future call site adds a field
 * this list doesn't know about yet; it just won't be shown until reviewed
 * and added here deliberately.
 */
export function sanitizeAuditMetadata(metadata: unknown): Record<string, unknown> | null {
  if (metadata === null || metadata === undefined || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }

  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata as Record<string, unknown>)) {
    if (ALLOWED_METADATA_KEYS.has(key)) {
      safe[key] = value;
    }
  }
  return Object.keys(safe).length > 0 ? safe : null;
}
