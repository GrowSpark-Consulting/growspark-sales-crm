import { describe, expect, it } from 'vitest';
import {
  COUNTRY_CALLING_CODES,
  E164_MAX_DIGITS,
  cleanTypedPhoneDigits,
  normalizePhoneInput,
  parsePhoneInput,
  phoneDigitLimits,
  phoneNumberProblem,
  isValidPhoneNumber,
  isValidManualEntryPhone,
  matchCountryCallingCode,
  toE164,
  phoneFieldSchema,
  parsePhoneLenient,
  normalizePhone,
  DEFAULT_COUNTRY_CALLING_CODE,
} from '@growspark/shared';

describe('isValidPhoneNumber (D99 per-country digit table)', () => {
  it('+91 accepts exactly 10 digits not starting with 0 — mobiles and landlines with their STD code', () => {
    expect(isValidPhoneNumber('+91', '9840012345')).toBe(true); // mobile
    expect(isValidPhoneNumber('+91', '6000000000')).toBe(true);
    expect(isValidPhoneNumber('+91', '4423456789')).toBe(true); // Chennai landline (D99: allowed)
    expect(isValidPhoneNumber('+91', '1123456789')).toBe(true); // Delhi landline
  });

  it('+91 rejects 9 or 11 digits, and a leading 0', () => {
    expect(isValidPhoneNumber('+91', '984001234')).toBe(false);
    expect(isValidPhoneNumber('+91', '98400123456')).toBe(false);
    expect(isValidPhoneNumber('+91', '0984012345')).toBe(false);
  });

  it('other countries use their own range from the table', () => {
    expect(isValidPhoneNumber('+1', '4155551234')).toBe(true); // 10
    expect(isValidPhoneNumber('+1', '415555123')).toBe(false); // 9
    expect(isValidPhoneNumber('+44', '2079460958')).toBe(true); // 10
    expect(isValidPhoneNumber('+44', '2012345')).toBe(false); // 7 — was allowed before D99
    expect(isValidPhoneNumber('+65', '81234567')).toBe(true); // 8
    expect(isValidPhoneNumber('+971', '501234567')).toBe(true); // 9
    expect(isValidPhoneNumber('+971', '123456789012345')).toBe(false); // 15 — was allowed before D99
    expect(isValidPhoneNumber('+49', '3012345678901')).toBe(true); // 13, Germany's E.164 cap
    expect(isValidPhoneNumber('+49', '30123456789012')).toBe(false);
  });

  it('rejects a code that is not in the table, and non-digits', () => {
    expect(isValidPhoneNumber('+999', '12345678')).toBe(false);
    expect(isValidPhoneNumber('+91', '98400 1234')).toBe(false);
  });
});

describe('the country table (D99)', () => {
  it('India is first and the default, and every entry keeps the whole number within E.164 (15 digits)', () => {
    expect(COUNTRY_CALLING_CODES[0]).toMatchObject({ code: '+91', minDigits: 10, maxDigits: 10 });
    expect(DEFAULT_COUNTRY_CALLING_CODE).toBe('+91');
    for (const country of COUNTRY_CALLING_CODES) {
      expect(country.minDigits).toBeLessThanOrEqual(country.maxDigits);
      expect(country.code.length - 1 + country.maxDigits, country.label).toBeLessThanOrEqual(E164_MAX_DIGITS);
    }
    expect(new Set(COUNTRY_CALLING_CODES.map((country) => country.code)).size).toBe(COUNTRY_CALLING_CODES.length);
  });

  it('phoneDigitLimits reads the table, and falls back to the E.164 maximum for a code outside it', () => {
    expect(phoneDigitLimits('+91')).toEqual({ min: 10, max: 10 });
    expect(phoneDigitLimits('+44')).toEqual({ min: 9, max: 10 });
    expect(phoneDigitLimits('+999')).toEqual({ min: 4, max: 12 });
  });

  it('every code is matched to itself, never shadowed by a shorter one', () => {
    for (const country of COUNTRY_CALLING_CODES) {
      expect(matchCountryCallingCode(`${country.code}12345678`)?.code).toBe(country.code);
    }
  });
});

describe('typing and pasting (D99)', () => {
  it('cleanTypedPhoneDigits keeps digits only and drops a leading 0', () => {
    expect(cleanTypedPhoneDigits('98a40-0(1)2 345')).toBe('9840012345');
    expect(cleanTypedPhoneDigits('098400 12345')).toBe('9840012345');
    expect(cleanTypedPhoneDigits('abc')).toBe('');
  });

  it('parsePhoneInput reads the common pasted shapes', () => {
    const ok = (countryCode: string, nationalDigits: string) => ({ ok: true, countryCode, nationalDigits });
    expect(parsePhoneInput('+91 98400-12345', '+91')).toEqual(ok('+91', '9840012345'));
    expect(parsePhoneInput('098400 12345', '+91')).toEqual(ok('+91', '9840012345'));
    expect(parsePhoneInput('919840012345', '+91')).toEqual(ok('+91', '9840012345'));
    expect(parsePhoneInput('0091 98400 12345', '+91')).toEqual(ok('+91', '9840012345'));
    expect(parsePhoneInput('+44 (0)20 7946 0958', '+91')).toEqual(ok('+44', '2079460958'));
    expect(parsePhoneInput('(415) 555-1234', '+1')).toEqual(ok('+1', '4155551234'));
    // Too short is fine here — it is flagged by validation, not refused while pasting.
    expect(parsePhoneInput('98400', '+91')).toEqual(ok('+91', '98400'));
  });

  it('parsePhoneInput refuses — never truncates — a number that is too long, an unknown code, or no digits', () => {
    expect(parsePhoneInput('984001234567', '+91')).toEqual({ ok: false, message: 'That number has 12 digits — India (+91) numbers have at most 10' });
    expect(parsePhoneInput('+999 1234 5678', '+91')).toMatchObject({ ok: false });
    expect(parsePhoneInput('call me', '+91')).toEqual({ ok: false, message: 'No digits found in that text' });
  });

  it('normalizePhoneInput (CSV import) gives E.164 for a complete number and null otherwise', () => {
    expect(normalizePhoneInput('98400 12345')).toBe('+919840012345');
    expect(normalizePhoneInput('098400 12345')).toBe('+919840012345');
    expect(normalizePhoneInput('+44 20 7946 0958')).toBe('+442079460958');
    expect(normalizePhoneInput('12345')).toBeNull();
    expect(normalizePhoneInput('98400123456')).toBeNull();
  });

  it('phoneNumberProblem says what is wrong — too short, too long or invalid — and nothing for a valid number', () => {
    expect(phoneNumberProblem('+91', '9840012345')).toBeNull();
    expect(phoneNumberProblem('+91', '98400')).toBe('Enter all 10 digits of the number for India (+91)');
    expect(phoneNumberProblem('+44', '20794')).toBe('Enter 9–10 digits for United Kingdom (+44)');
    expect(phoneNumberProblem('+91', '98400123456')).toBe('India (+91) numbers have at most 10 digits');
    expect(phoneNumberProblem('+91', '0984001234')).toBe('Leave out the leading 0');
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

  it('the schema message says what is wrong (the server sends the same text)', () => {
    expect(phoneFieldSchema.safeParse('+9198400').error?.issues[0]?.message).toBe('Enter all 10 digits of the number for India (+91)');
    expect(phoneFieldSchema.safeParse('+99912345678').error?.issues[0]?.message).toBe('Choose a country code from the list');
    expect(phoneFieldSchema.safeParse('+914423456789').success).toBe(true); // landline
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
