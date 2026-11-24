import { describe, expect, it } from 'vitest';
import { API_KEY_PREFIX, generateApiKey, hashApiKey, verifyApiKeyHash } from '../../src/lib/api-key.js';

describe('generateApiKey', () => {
  it('produces a key with the recognisable literal prefix', () => {
    const { key } = generateApiKey();
    expect(key.startsWith(API_KEY_PREFIX)).toBe(true);
  });

  it('produces a keyPrefix that is itself a prefix of the key, longer than the literal prefix alone', () => {
    const { key, keyPrefix } = generateApiKey();
    expect(key.startsWith(keyPrefix)).toBe(true);
    expect(keyPrefix.length).toBeGreaterThan(API_KEY_PREFIX.length);
  });

  it('has a consistent length every time (32 random bytes, base64url, no padding)', () => {
    const lengths = new Set(Array.from({ length: 20 }, () => generateApiKey().key.length));
    expect(lengths.size).toBe(1);
  });

  it('generates a different raw key every call', () => {
    const keys = new Set(Array.from({ length: 50 }, () => generateApiKey().key));
    expect(keys.size).toBe(50);
  });
});

describe('hashApiKey', () => {
  it('is deterministic — the same input always produces the same hash', () => {
    const { key } = generateApiKey();
    expect(hashApiKey(key)).toBe(hashApiKey(key));
  });

  it('produces different hashes for different keys', () => {
    const a = generateApiKey().key;
    const b = generateApiKey().key;
    expect(hashApiKey(a)).not.toBe(hashApiKey(b));
  });

  it('never equals the raw key it hashed', () => {
    const { key } = generateApiKey();
    expect(hashApiKey(key)).not.toBe(key);
  });

  it('produces a 64-character lowercase hex string (SHA-256)', () => {
    const { key } = generateApiKey();
    expect(hashApiKey(key)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('verifyApiKeyHash', () => {
  it('returns true for a matching pair', () => {
    const { key } = generateApiKey();
    const hash = hashApiKey(key);
    expect(verifyApiKeyHash(hash, hash)).toBe(true);
  });

  it('returns false for a mismatched pair of the same length', () => {
    const hashA = hashApiKey(generateApiKey().key);
    const hashB = hashApiKey(generateApiKey().key);
    expect(hashA).not.toBe(hashB); // sanity: the fixture itself must differ
    expect(verifyApiKeyHash(hashA, hashB)).toBe(false);
  });

  it('returns false, without throwing, for differently-sized input', () => {
    const hash = hashApiKey(generateApiKey().key);
    expect(() => verifyApiKeyHash(hash, 'too-short')).not.toThrow();
    expect(verifyApiKeyHash(hash, 'too-short')).toBe(false);
    expect(() => verifyApiKeyHash('also-too-short', hash)).not.toThrow();
    expect(verifyApiKeyHash('also-too-short', hash)).toBe(false);
  });
});
