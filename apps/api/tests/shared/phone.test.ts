import { describe, expect, it } from 'vitest';
import {
  isValidPhoneNumber,
  isValidManualEntryPhone,
  matchCountryCallingCode,
  toE164,
  phoneFieldSchema,
  parsePhoneLenient,
  normalizePhone,
  DEFAULT_COUNTRY_CALLING_CODE,
} from '@growspark/shared';

describe('isValidPhoneNumber (D41 per-country shape rule)', () => {
  it('+91 accepts exactly 10 digits starting 6-9', () => {
    expect(isValidPhoneNumber('+91', '9840012345')).toBe(true);
    expect(isValidPhoneNumber('+91', '6000000000')).toBe(true);
  });

  it('+91 rejects too few digits', () => {
    expect(isValidPhoneNumber('+91', '984001234')).toBe(false); // 9 digits
  });

  it('+91 rejects too many digits', () => {
    expect(isValidPhoneNumber('+91', '98400123456')).toBe(false); // 11 digits
  });

  it('+91 rejects a wrong starting digit (and a leading 0 in particular)', () => {
    expect(isValidPhoneNumber('+91', '0984012345')).toBe(false); // leading 0, also 10 digits
    expect(isValidPhoneNumber('+91', '5840012345')).toBe(false); // starts with 5
  });

  it('other country codes accept 7-15 digits with no leading-digit rule', () => {
    expect(isValidPhoneNumber('+1', '4155551234')).toBe(true); // 10 digits
    expect(isValidPhoneNumber('+44', '2012345')).toBe(true); // 7 digits (minimum)
    expect(isValidPhoneNumber('+971', '123456789012345')).toBe(true); // 15 digits (maximum)
  });

  it('other country codes reject outside the 7-15 digit range', () => {
    expect(isValidPhoneNumber('+1', '123456')).toBe(false); // 6 digits
    expect(isValidPhoneNumber('+44', '1234567890123456')).toBe(false); // 16 digits
  });
});

describe('matchCountryCallingCode', () => {
  it('finds the matching known code by prefix', () => {
    expect(matchCountryCallingCode('+919840012345')?.code).toBe('+91');
    expect(matchCountryCallingCode('+14155551234')?.code).toBe('+1');
  });

  it('returns undefined for an unrecognised prefix', () => {
    expect(matchCountryCallingCode('+9999999999')).toBeUndefined();
  });
});

describe('toE164', () => {
  it('joins a country code and a national number, stripping non-digits (spaces)', () => {
    expect(toE164('+91', '98400 12345')).toBe('+919840012345');
  });
});

describe('isValidManualEntryPhone / phoneFieldSchema (strict, manual CRM entry)', () => {
  it('accepts a valid +91 E.164 string', () => {
    expect(isValidManualEntryPhone('+919840012345')).toBe(true);
    expect(phoneFieldSchema.safeParse('+919840012345').success).toBe(true);
  });

  it('rejects 11+ digits for +91', () => {
    expect(isValidManualEntryPhone('+9198400123456')).toBe(false);
    expect(phoneFieldSchema.safeParse('+9198400123456').success).toBe(false);
  });

  it('rejects a value with no leading +', () => {
    expect(isValidManualEntryPhone('919840012345')).toBe(false);
  });

  it('rejects a value with interior spaces (the frontend must send clean E.164)', () => {
    expect(isValidManualEntryPhone('+91 98400 12345')).toBe(false);
  });

  it('allows blank — phone is optional, "" clears the field', () => {
    expect(phoneFieldSchema.safeParse('').success).toBe(true);
  });
});

describe('parsePhoneLenient (reserved for the future website intake path — never rejects)', () => {
  it('preserves a leading plus, stripping spaces/punctuation', () => {
    expect(parsePhoneLenient('+91 98400 12345')).toBe('+919840012345');
  });

  it('assumes the default market for a bare 10-digit number with no country code', () => {
    expect(parsePhoneLenient('9840012345')).toBe(`${DEFAULT_COUNTRY_CALLING_CODE}9840012345`);
  });

  it('never throws, and never rejects an oddly-shaped value — keeps the digits as-is', () => {
    expect(parsePhoneLenient('098400123456789')).toBe('098400123456789');
    expect(() => parsePhoneLenient('not a phone number at all')).not.toThrow();
  });

  it('returns null for blank or missing input', () => {
    expect(parsePhoneLenient('')).toBeNull();
    expect(parsePhoneLenient(null)).toBeNull();
    expect(parsePhoneLenient(undefined)).toBeNull();
  });
});

describe('cross-format duplicate matching (D41) — normalizePhone is unchanged and still lenient', () => {
  it('"98400 12345", "9840012345", and "+91 98400 12345" normalise identically once in the same canonical form', () => {
    // A pre-D41 raw digit string (no country code typed) vs. the new
    // structured input's canonical E.164 form: normalizePhone alone cannot
    // make these equal (it has no country-code knowledge) — that is exactly
    // why storage now always goes through toE164 first. Once both are in
    // E.164 form, differently-spaced variants of the *same* number always
    // normalise identically:
    expect(normalizePhone('+91 98400 12345')).toBe(normalizePhone('+919840012345'));
    expect(normalizePhone(toE164('+91', '98400 12345'))).toBe(normalizePhone(toE164('+91', '9840012345')));
  });
});
