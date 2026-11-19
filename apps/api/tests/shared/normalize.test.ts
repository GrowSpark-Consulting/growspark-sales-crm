import { describe, expect, it } from 'vitest';
import { normalizeEmail, normalizePhone, normalizeCompanyName } from '@growspark/shared';

describe('normalizeEmail', () => {
  it('lower-cases and trims', () => {
    expect(normalizeEmail('  Asha.Rao@Example.COM  ')).toBe('asha.rao@example.com');
  });

  it('returns null for blank, whitespace-only, or missing input', () => {
    expect(normalizeEmail('')).toBeNull();
    expect(normalizeEmail('   ')).toBeNull();
    expect(normalizeEmail(null)).toBeNull();
    expect(normalizeEmail(undefined)).toBeNull();
  });
});

describe('normalizePhone', () => {
  it('reduces to digits only, with no leading plus', () => {
    expect(normalizePhone('098765 43210')).toBe('09876543210');
    expect(normalizePhone('(080) 1234-5678')).toBe('08012345678');
  });

  it('preserves a leading plus', () => {
    expect(normalizePhone('+91 98765 43210')).toBe('+919876543210');
  });

  it('returns null for blank, digit-less, or missing input', () => {
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone('N/A')).toBeNull();
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
  });
});

describe('normalizeCompanyName', () => {
  it('lower-cases, trims, and strips a trailing legal-entity suffix', () => {
    expect(normalizeCompanyName('Example Foods Pvt. Ltd.')).toBe('example foods');
    expect(normalizeCompanyName('  Example Foods Pvt Ltd  ')).toBe('example foods');
  });

  it('strips suffixes iteratively when more than one is stacked', () => {
    expect(normalizeCompanyName('Acme Corp Inc')).toBe('acme');
  });

  it('collapses punctuation and repeated whitespace', () => {
    expect(normalizeCompanyName("O'Brien & Sons,  LLC")).toBe('o brien sons');
  });

  it('treats different-casing/suffix variants of the same company as equal', () => {
    expect(normalizeCompanyName('Example Foods Pvt Ltd')).toBe(normalizeCompanyName('example foods'));
    expect(normalizeCompanyName('EXAMPLE FOODS PRIVATE LIMITED')).toBe(normalizeCompanyName('Example Foods'));
  });

  it('returns null for blank, suffix-only, or missing input', () => {
    expect(normalizeCompanyName('')).toBeNull();
    expect(normalizeCompanyName('Ltd.')).toBeNull();
    expect(normalizeCompanyName(null)).toBeNull();
    expect(normalizeCompanyName(undefined)).toBeNull();
  });
});
