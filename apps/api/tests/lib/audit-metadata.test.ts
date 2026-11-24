import { describe, expect, it } from 'vitest';
import { sanitizeAuditMetadata } from '../../src/lib/audit-metadata.js';

describe('sanitizeAuditMetadata', () => {
  it('passes through every key a real writeAudit() call site actually uses', () => {
    expect(sanitizeAuditMetadata({ changedFields: ['name', 'role'], oldRole: 'STAFF', newRole: 'ADMIN' })).toEqual({
      changedFields: ['name', 'role'],
      oldRole: 'STAFF',
      newRole: 'ADMIN',
    });
    expect(sanitizeAuditMetadata({ keyPrefix: 'gsk_live_abc123' })).toEqual({ keyPrefix: 'gsk_live_abc123' });
  });

  it('drops a key not on the allowlist, however it got there', () => {
    expect(
      sanitizeAuditMetadata({ name: 'Example Co', rawKey: 'gsk_live_secretvalue', passwordHash: '$argon2id$...' }),
    ).toEqual({ name: 'Example Co' });
  });

  it('drops common sensitive-sounding keys specifically', () => {
    for (const dangerous of ['key', 'apiKey', 'password', 'passwordHash', 'token', 'sessionToken', 'secret', 'hash']) {
      const result = sanitizeAuditMetadata({ [dangerous]: 'should-never-appear', name: 'kept' });
      expect(result).not.toHaveProperty(dangerous);
      expect(result).toEqual({ name: 'kept' });
    }
  });

  it('returns null for null, undefined, an array, or a non-object value', () => {
    expect(sanitizeAuditMetadata(null)).toBeNull();
    expect(sanitizeAuditMetadata(undefined)).toBeNull();
    expect(sanitizeAuditMetadata(['a', 'b'])).toBeNull();
    expect(sanitizeAuditMetadata('a string')).toBeNull();
  });

  it('returns null when every key is dropped, rather than an empty object', () => {
    expect(sanitizeAuditMetadata({ rawKey: 'secret' })).toBeNull();
  });
});
