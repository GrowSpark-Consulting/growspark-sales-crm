/**
 * The quotation money rule lives in `@growspark/shared` (D101) so the API and
 * the quotation form's live preview run the very same function. This module
 * keeps the API-side import path and the one Prisma-specific helper.
 */
export { calculateQuotationAmounts, groupGstByRate, normalizePercent } from '@growspark/shared';
export type { QuotationAmounts, QuotationMoneyLine } from '@growspark/shared';

/** Stored Decimal(…,2) columns as fixed 2-dp strings — "0" never comes back as "0" instead of "0.00" (D47's finding). */
export function toMoneyString(value: { toFixed(digits: number): string }): string {
  return value.toFixed(2);
}
