/**
 * Pure normalisation functions, used identically by every service that
 * writes a leads/companies/contacts row (so the stored *Normalized column
 * always matches what the duplicate finder compares against) and by the
 * frontend for live client-side duplicate hints. No side effects, no I/O.
 */

/** Lower-cased, trimmed. Returns null for blank/missing input (never ""). */
export function normalizeEmail(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed.toLowerCase() : null;
}

/**
 * Digits only, with an optional leading "+" preserved if present in the
 * input (so "+91 98765 43210" -> "+919876543210" and "098765 43210" ->
 * "098765432 10"... i.e. "09876543210"). Returns null for blank/missing
 * input or input with no digits at all.
 */
export function normalizePhone(value: string | null | undefined): string | null {
  if (!value) return null;
  const hasLeadingPlus = value.trim().startsWith('+');
  const digits = value.replace(/\D/g, '');
  if (!digits) return null;
  return hasLeadingPlus ? `+${digits}` : digits;
}

// Longest/most-specific phrases first, so e.g. "private limited" is tried
// before the bare "limited" would otherwise match part of it. The loop below
// re-scans after every strip anyway, so order only affects how many passes
// it takes, not the final result — kept ordered for readability.
const COMPANY_SUFFIXES = [
  'private limited',
  'pvt ltd',
  'pte ltd',
  'ltd',
  'llp',
  'llc',
  'pvt',
  'inc',
  'incorporated',
  'corporation',
  'corp',
  'limited',
  'co',
];

/**
 * Lower-cased, trimmed, punctuation collapsed to spaces, and any trailing
 * legal-entity suffix (Pvt, Ltd, LLP, Inc, and similar — see
 * COMPANY_SUFFIXES) stripped, repeatedly, so "Example Foods Pvt. Ltd."
 * and "Example Foods" normalise to the same value. Returns null for
 * blank/missing input or input that normalises to nothing (e.g. "Ltd." alone).
 */
export function normalizeCompanyName(value: string | null | undefined): string | null {
  if (!value) return null;

  let name = value
    .trim()
    .toLowerCase()
    .replace(/[.,'"&()-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  let changed = true;
  while (changed && name) {
    changed = false;
    for (const suffix of COMPANY_SUFFIXES) {
      if (name === suffix) {
        name = '';
        changed = true;
        break;
      }
      if (name.endsWith(` ${suffix}`)) {
        name = name.slice(0, -(suffix.length + 1)).trim();
        changed = true;
        break;
      }
    }
  }

  return name || null;
}
