import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';

/**
 * Cosmetic/recognisable only — see docs/decisions.md D71's "API key format
 * and verification" bullet. Never used for lookup (keyHash, below, is).
 */
export const API_KEY_PREFIX = 'gsk_live_';

/**
 * How much of the generated key is stored as `keyPrefix`, for display in the
 * API Keys list (e.g. "gsk_live_AbCdEf…") once the raw key itself is gone —
 * just enough to tell keys apart visually, nowhere near enough to
 * reconstruct the real key from.
 */
const DISPLAY_PREFIX_LENGTH = API_KEY_PREFIX.length + 6;

export interface GeneratedApiKey {
  /** The raw key — returned to the caller exactly once, never stored. */
  key: string;
  keyPrefix: string;
}

/** A long random value with a recognisable literal prefix (D71). */
export function generateApiKey(): GeneratedApiKey {
  const key = `${API_KEY_PREFIX}${randomBytes(32).toString('base64url')}`;
  return { key, keyPrefix: key.slice(0, DISPLAY_PREFIX_LENGTH) };
}

/** Same hashing pattern as session.ts's hashSessionToken — only this hash is ever stored. */
export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

/**
 * Exact-match hash comparison via crypto.timingSafeEqual rather than `===` —
 * defense-in-depth layered on top of the already-exact, indexed
 * `findUnique({ where: { keyHash } })` lookup that finds `storedHash` in the
 * first place. Honestly scoped (D71): this is not a claim that it closes a
 * timing side-channel the database lookup itself might still have.
 */
export function verifyApiKeyHash(computedHash: string, storedHash: string): boolean {
  const computed = Buffer.from(computedHash, 'hex');
  const stored = Buffer.from(storedHash, 'hex');
  if (computed.length !== stored.length) {
    return false;
  }
  return timingSafeEqual(computed, stored);
}
