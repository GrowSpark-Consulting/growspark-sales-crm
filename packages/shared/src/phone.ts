import { z } from 'zod';

/**
 * D41: a fixed, closed set of selectable country calling codes for the
 * manual-entry phone UI (Company/Contact/Lead forms) — not an attempt at a
 * complete E.164 country list. India is first/default, since Grow Spark
 * Consulting is the only organisation this product serves today (D6).
 * A judgment call on which other codes to offer; add more here if a real
 * need comes up, since the frontend select and the server-side matcher
 * below both read this same list.
 */
export interface CountryCallingCode {
  readonly code: string;
  readonly label: string;
}

export const COUNTRY_CALLING_CODES: readonly CountryCallingCode[] = [
  { code: '+91', label: 'India (+91)' },
  { code: '+1', label: 'US / Canada (+1)' },
  { code: '+44', label: 'United Kingdom (+44)' },
  { code: '+971', label: 'UAE (+971)' },
  { code: '+966', label: 'Saudi Arabia (+966)' },
  { code: '+65', label: 'Singapore (+65)' },
  { code: '+61', label: 'Australia (+61)' },
  { code: '+49', label: 'Germany (+49)' },
  { code: '+33', label: 'France (+33)' },
  { code: '+81', label: 'Japan (+81)' },
  { code: '+86', label: 'China (+86)' },
  { code: '+27', label: 'South Africa (+27)' },
];

export const DEFAULT_COUNTRY_CALLING_CODE = '+91';

/**
 * Longest-prefix match first, so a shorter code (e.g. +1) never shadows a
 * longer one that happens to start with the same digits (none currently do
 * in COUNTRY_CALLING_CODES, but this keeps it correct if one is added).
 */
export function matchCountryCallingCode(value: string): CountryCallingCode | undefined {
  const byLongestCodeFirst = [...COUNTRY_CALLING_CODES].sort((a, b) => b.code.length - a.code.length);
  return byLongestCodeFirst.find((candidate) => value.startsWith(candidate.code));
}

/**
 * D41: +91 must be exactly 10 digits starting 6–9 (the real shape of an
 * Indian mobile number); every other supported code is 7–15 digits, with no
 * further shape check — this product has no per-country numbering-plan data
 * beyond India's.
 */
export function isValidPhoneNumber(countryCode: string, nationalDigits: string): boolean {
  if (countryCode === DEFAULT_COUNTRY_CALLING_CODE) {
    return /^[6-9]\d{9}$/.test(nationalDigits);
  }
  return /^\d{7,15}$/.test(nationalDigits);
}

/** Digits-only national number, joined onto its country code — e.g. ("+91", "98400 12345") -> "+919840012345". */
export function toE164(countryCode: string, nationalNumber: string): string {
  return `${countryCode}${nationalNumber.replace(/\D/g, '')}`;
}

/**
 * Strict check used by the manual-entry Zod schemas below: the value must
 * already be a clean E.164 string (no spaces/punctuation) whose country-code
 * prefix is one of COUNTRY_CALLING_CODES and whose remaining digits satisfy
 * isValidPhoneNumber. The frontend's PhoneInput only ever emits a value in
 * this exact shape; a direct API caller is held to the same rule.
 */
export function isValidManualEntryPhone(value: string): boolean {
  if (!value.startsWith('+')) return false;
  const match = matchCountryCallingCode(value);
  if (!match) return false;
  const nationalDigits = value.slice(match.code.length);
  return isValidPhoneNumber(match.code, nationalDigits);
}

/**
 * D41: strict validation for manual CRM data entry only. Blank ("") stays
 * valid — phone is optional, and "" is how every optional text field in this
 * app already represents "not provided"/"clear this field" (see
 * stripEmptyOptionalFields). Do not reuse this for the website intake path
 * once built — see parsePhoneLenient below.
 */
export const phoneFieldSchema = z
  .string()
  .trim()
  .max(20, 'Phone number is too long')
  .refine((value) => value === '' || isValidManualEntryPhone(value), 'Enter a valid phone number');

/**
 * D41: reserved for the not-yet-built website intake path (Day 5+) — an
 * enquiry must never be rejected over a phone format, so this never throws
 * and never refuses input, unlike isValidManualEntryPhone/phoneFieldSchema
 * above. Deliberately a separate function: do not let the intake path share
 * the strict manual-entry validator, and do not call this from the
 * Company/Contact/Lead manual-entry schemas.
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
