import { z } from 'zod';

/**
 * D41 → D99: the closed list of country calling codes the phone input offers,
 * each with the length of its *national significant number* (the digits after
 * the country code, without the domestic trunk "0"). India is first and the
 * default — Grow Spark Consulting is the only organisation today (D6). The
 * frontend input, the server-side check and the CSV import all read this
 * table; there is no per-country numbering-plan data beyond these lengths.
 *
 * Lengths are deliberately simple ranges covering mobiles and landlines, not a
 * full numbering plan. Add a country here when a real need comes up.
 */
export interface CountryCallingCode {
  readonly code: string;
  readonly label: string;
  /** Fewest digits after the country code that can be a complete number. */
  readonly minDigits: number;
  /** Most digits after the country code; the input stops accepting more. */
  readonly maxDigits: number;
}

export const DEFAULT_COUNTRY_CALLING_CODE = '+91';

/** E.164: at most 15 digits in total, country code included. */
export const E164_MAX_DIGITS = 15;

export const COUNTRY_CALLING_CODES: readonly CountryCallingCode[] = [
  // India: exactly 10 digits — mobiles (6–9…) and landlines with their STD code
  // (e.g. 44 2345 6789 for Chennai, 11 2345 6789 for Delhi). D99: landlines
  // allowed, so the rule is "10 digits, not starting with 0".
  { code: '+91', label: 'India (+91)', minDigits: 10, maxDigits: 10 },
  { code: '+61', label: 'Australia (+61)', minDigits: 9, maxDigits: 9 },
  { code: '+973', label: 'Bahrain (+973)', minDigits: 8, maxDigits: 8 },
  { code: '+880', label: 'Bangladesh (+880)', minDigits: 8, maxDigits: 10 },
  { code: '+86', label: 'China (+86)', minDigits: 9, maxDigits: 11 },
  { code: '+33', label: 'France (+33)', minDigits: 9, maxDigits: 9 },
  // Germany's numbers genuinely vary in length; capped by E.164 (15 − 2).
  { code: '+49', label: 'Germany (+49)', minDigits: 6, maxDigits: 13 },
  { code: '+852', label: 'Hong Kong (+852)', minDigits: 8, maxDigits: 8 },
  { code: '+81', label: 'Japan (+81)', minDigits: 9, maxDigits: 10 },
  { code: '+965', label: 'Kuwait (+965)', minDigits: 8, maxDigits: 8 },
  { code: '+60', label: 'Malaysia (+60)', minDigits: 8, maxDigits: 10 },
  { code: '+977', label: 'Nepal (+977)', minDigits: 8, maxDigits: 10 },
  { code: '+31', label: 'Netherlands (+31)', minDigits: 9, maxDigits: 9 },
  { code: '+64', label: 'New Zealand (+64)', minDigits: 8, maxDigits: 10 },
  { code: '+968', label: 'Oman (+968)', minDigits: 8, maxDigits: 8 },
  { code: '+974', label: 'Qatar (+974)', minDigits: 8, maxDigits: 8 },
  { code: '+966', label: 'Saudi Arabia (+966)', minDigits: 8, maxDigits: 9 },
  { code: '+65', label: 'Singapore (+65)', minDigits: 8, maxDigits: 8 },
  { code: '+27', label: 'South Africa (+27)', minDigits: 9, maxDigits: 9 },
  { code: '+94', label: 'Sri Lanka (+94)', minDigits: 9, maxDigits: 9 },
  { code: '+971', label: 'UAE (+971)', minDigits: 8, maxDigits: 9 },
  { code: '+44', label: 'United Kingdom (+44)', minDigits: 9, maxDigits: 10 },
  { code: '+1', label: 'US / Canada (+1)', minDigits: 10, maxDigits: 10 },
];

const BY_LONGEST_CODE_FIRST = [...COUNTRY_CALLING_CODES].sort((a, b) => b.code.length - a.code.length);

/**
 * Longest-prefix match, so a shorter code never shadows a longer one that
 * starts with the same digits.
 */
export function matchCountryCallingCode(value: string): CountryCallingCode | undefined {
  return BY_LONGEST_CODE_FIRST.find((candidate) => value.startsWith(candidate.code));
}

/**
 * The allowed national-number length for a code. A code outside the table
 * (never offered by the input) falls back to E.164's limit: at most 15 digits
 * including the country code.
 */
export function phoneDigitLimits(countryCode: string): { min: number; max: number } {
  const country = COUNTRY_CALLING_CODES.find((candidate) => candidate.code === countryCode);
  if (country) return { min: country.minDigits, max: country.maxDigits };
  return { min: 4, max: E164_MAX_DIGITS - countryCode.replace(/\D/g, '').length };
}

function countryLabel(countryCode: string): string {
  return COUNTRY_CALLING_CODES.find((candidate) => candidate.code === countryCode)?.label ?? countryCode;
}

function digitRange(min: number, max: number): string {
  return min === max ? `${max} digits` : `${min}–${max} digits`;
}

/**
 * What is wrong with a national number, in words for the person typing it —
 * or null when it is a complete, valid number. D99: only "too short" and
 * genuinely invalid numbers produce a message.
 */
export function phoneNumberProblem(countryCode: string, nationalDigits: string): string | null {
  const country = COUNTRY_CALLING_CODES.find((candidate) => candidate.code === countryCode);
  if (!country) return 'Choose a country code from the list';
  if (!/^\d+$/.test(nationalDigits)) return 'Use digits only';
  if (nationalDigits.startsWith('0')) return 'Leave out the leading 0';
  const range = digitRange(country.minDigits, country.maxDigits);
  if (nationalDigits.length < country.minDigits) {
    return country.minDigits === country.maxDigits
      ? `Enter all ${range} of the number for ${country.label}`
      : `Enter ${range} for ${country.label}`;
  }
  if (nationalDigits.length > country.maxDigits) return `${country.label} numbers have at most ${country.maxDigits} digits`;
  return null;
}

/**
 * D99: a national number is valid when its country is in the table, it is all
 * digits, it does not start with 0 (the domestic trunk prefix is never part of
 * the international form), and its length is within the country's range.
 * For India that is exactly "10 digits, not starting with 0".
 */
export function isValidPhoneNumber(countryCode: string, nationalDigits: string): boolean {
  return phoneNumberProblem(countryCode, nationalDigits) === null;
}

/** Digits-only national number, joined onto its country code — e.g. ("+91", "98400 12345") -> "+919840012345". */
export function toE164(countryCode: string, nationalNumber: string): string {
  return `${countryCode}${nationalNumber.replace(/\D/g, '')}`;
}

/**
 * D99, while typing: keeps digits only (letters and symbols are ignored) and
 * drops leading zeros (a typed trunk "0", as in 098400 12345). The caller
 * compares the result's length with phoneDigitLimits() to refuse a digit past
 * the country's limit.
 */
export function cleanTypedPhoneDigits(raw: string): string {
  return raw.replace(/\D/g, '').replace(/^0+/, '');
}

export type ParsedPhoneInput =
  | { ok: true; countryCode: string; nationalDigits: string }
  | { ok: false; message: string };

/**
 * D99: turns pasted or imported text into a country code plus national
 * digits. Handles "+91 98400-12345", "0091 98400 12345", "098400 12345",
 * "919840012345" (with India selected) and "+44 (0)20 7946 0958" (switches the
 * country). Never truncates: a number that is still too long after clean-up
 * is refused with a message, because cutting digits off could quietly produce
 * a different, valid-looking number.
 */
export function parsePhoneInput(text: string, currentCountryCode: string = DEFAULT_COUNTRY_CALLING_CODE): ParsedPhoneInput {
  const trimmed = text.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return { ok: false, message: 'No digits found in that text' };

  let countryCode = currentCountryCode;
  let national: string;
  const international = trimmed.startsWith('+') || /^00[1-9]/.test(digits);
  if (international) {
    const withoutPrefix = trimmed.startsWith('+') ? digits : digits.slice(2);
    const match = matchCountryCallingCode(`+${withoutPrefix}`);
    if (!match) return { ok: false, message: `+${withoutPrefix.slice(0, 3)}… is not a country code in the list` };
    countryCode = match.code;
    national = withoutPrefix.slice(match.code.length - 1).replace(/^0+/, '');
  } else {
    national = digits.replace(/^0+/, '');
    const { max } = phoneDigitLimits(countryCode);
    const codeDigits = countryCode.slice(1);
    // "919840012345" pasted with India selected: the country code typed without its "+".
    if (national.length > max && national.startsWith(codeDigits)) {
      const rest = national.slice(codeDigits.length).replace(/^0+/, '');
      if (rest.length <= max) national = rest;
    }
  }

  const { max } = phoneDigitLimits(countryCode);
  if (national.length > max) {
    return { ok: false, message: `That number has ${national.length} digits — ${countryLabel(countryCode)} numbers have at most ${max}` };
  }
  return { ok: true, countryCode, nationalDigits: national };
}

/**
 * D99, CSV import: free text → a valid E.164 string, or null when it cannot be
 * read as a complete number for the (default India) country.
 */
export function normalizePhoneInput(text: string, defaultCountryCode: string = DEFAULT_COUNTRY_CALLING_CODE): string | null {
  const parsed = parsePhoneInput(text, defaultCountryCode);
  if (!parsed.ok || !isValidPhoneNumber(parsed.countryCode, parsed.nationalDigits)) return null;
  return toE164(parsed.countryCode, parsed.nationalDigits);
}

/** Why a stored/submitted E.164 value is not acceptable, or null when it is. */
export function manualEntryPhoneProblem(value: string): string | null {
  if (!value.startsWith('+')) return 'Enter a valid phone number';
  const match = matchCountryCallingCode(value);
  if (!match) return 'Choose a country code from the list';
  return phoneNumberProblem(match.code, value.slice(match.code.length));
}

/**
 * Strict check used by the manual-entry Zod schemas below: the value must
 * already be a clean E.164 string (no spaces/punctuation) whose country-code
 * prefix is in COUNTRY_CALLING_CODES and whose remaining digits satisfy
 * isValidPhoneNumber. The frontend's PhoneInput only ever emits a value in
 * this exact shape; a direct API caller is held to the same rule.
 */
export function isValidManualEntryPhone(value: string): boolean {
  return manualEntryPhoneProblem(value) === null;
}

/**
 * D41/D99: strict validation for manual CRM data entry only. Blank ("") stays
 * valid — phone is optional, and "" is how every optional text field in this
 * app represents "not provided"/"clear this field". The message says what is
 * wrong ("Enter all 10 digits of the number for India (+91)"). Not used by the
 * website intake path — see parsePhoneLenient below.
 */
export const phoneFieldSchema = z
  .string()
  .trim()
  .max(20, 'Phone number is too long')
  .superRefine((value, ctx) => {
    if (value === '') return;
    const problem = manualEntryPhoneProblem(value);
    if (problem) ctx.addIssue({ code: 'custom', message: problem });
  });

/**
 * D41: for the website intake path only — an enquiry must never be rejected
 * over a phone format, so this never throws and never refuses input, unlike
 * the strict manual-entry rules above. Do not use it for manual entry.
 *
 * Best-effort only: keeps a leading "+" and its digits as-is; a plausible
 * bare 10-digit number is assumed to be the default market (+91) without a
 * country code typed; anything else is kept as digits-only, unguessed.
 */
export function parsePhoneLenient(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const hasLeadingPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;
  if (hasLeadingPlus) return `+${digits}`;
  if (digits.length === 10) return `${DEFAULT_COUNTRY_CALLING_CODE}${digits}`;
  return digits;
}
