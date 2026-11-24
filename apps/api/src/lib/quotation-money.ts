import { Prisma } from '../generated/prisma/client.js';

const Decimal = Prisma.Decimal;
type DecimalValue = InstanceType<typeof Decimal>;

/**
 * The quotation money rule (D85). Every step uses exact decimal arithmetic
 * (Prisma's bundled decimal.js), never a JavaScript float, and every rounding
 * is HALF-UP to 2 decimal places (0.005 rounds up to 0.01):
 *
 *   line total      = round2(quantity × unit price × (100 − line discount %) / 100)
 *   subtotal        = sum of line totals                        (already 2dp, no rounding)
 *   discount amount = round2(subtotal × quotation discount % / 100)
 *   taxable amount  = subtotal − discount amount                (no rounding)
 *   tax amount      = round2(taxable amount × GST % / 100)
 *   total           = taxable amount + tax amount               (no rounding)
 *
 * Rounding happens exactly three times per quotation (once per line, once for
 * the discount, once for the tax), so the printed subtotal, discount, tax and
 * total always add up exactly on the page.
 */
function round2(value: DecimalValue): DecimalValue {
  return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export interface MoneyLineInput {
  quantity: string;
  unitPrice: string;
  discountPercent?: string | undefined;
}

export interface QuotationTotalsResult {
  lineTotals: string[];
  subtotal: string;
  discountAmount: string;
  taxableAmount: string;
  taxAmount: string;
  total: string;
}

export function calculateLineTotal(line: MoneyLineInput): string {
  const discount = new Decimal(line.discountPercent ?? '0');
  const gross = new Decimal(line.quantity).times(line.unitPrice);
  return round2(gross.times(new Decimal(100).minus(discount)).dividedBy(100)).toFixed(2);
}

export function calculateQuotationTotals(
  lines: readonly MoneyLineInput[],
  discountPercent: string,
  taxPercent: string,
): QuotationTotalsResult {
  const lineTotals = lines.map(calculateLineTotal);
  const subtotal = lineTotals.reduce((sum, value) => sum.plus(value), new Decimal(0));
  const discountAmount = round2(subtotal.times(discountPercent).dividedBy(100));
  const taxable = subtotal.minus(discountAmount);
  const taxAmount = round2(taxable.times(taxPercent).dividedBy(100));
  const total = taxable.plus(taxAmount);
  return {
    lineTotals,
    subtotal: subtotal.toFixed(2),
    discountAmount: discountAmount.toFixed(2),
    taxableAmount: taxable.toFixed(2),
    taxAmount: taxAmount.toFixed(2),
    total: total.toFixed(2),
  };
}

/** Stored Decimal(…,2) columns as fixed 2-dp strings — "0" never comes back as "0" instead of "0.00" (D47's finding). */
export function toMoneyString(value: { toFixed(digits: number): string }): string {
  return value.toFixed(2);
}
