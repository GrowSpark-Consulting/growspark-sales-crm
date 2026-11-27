/**
 * The quotation money rule (D85, revised by D101) — ONE function used by both
 * the API (the source of truth, recalculated on every save) and the quotation
 * form's live preview, so the two can never disagree.
 *
 * Exact arithmetic with BigInt on integer-scaled values: every input is a
 * decimal string with at most 2 decimal places, so there is never a JavaScript
 * float anywhere. Every rounding is HALF-UP to 2 decimal places (0.005 -> 0.01),
 * once per line per amount.
 *
 *   lineGross   = round2(quantity × unit price × (1 − line discount % / 100))
 *
 *   Tax exclusive:  lineTaxable = lineGross
 *                   lineGst     = round2(lineTaxable × GST % / 100)
 *                   lineTotal   = lineTaxable + lineGst
 *
 *   Tax inclusive:  lineTaxable = round2(lineGross / (1 + GST % / 100))
 *                   lineGst     = lineGross − lineTaxable
 *                   lineTotal   = lineGross
 *
 *   Subtotal = Σ lineTaxable     GST breakdown = Σ lineGst per distinct rate
 *   Total    = Σ lineTotal
 *
 * Because every line amount is already rounded to the paisa, the printed
 * subtotal + GST rows always add up to the printed total exactly.
 */

export interface QuotationMoneyLine {
  quantity: string;
  unitPrice: string;
  /** Percent, 0–100, up to 2 dp. Blank/undefined means 0. */
  discountPercent?: string | undefined;
  /** Percent, 0–100, up to 2 dp. Blank/undefined means 0 (exempt). */
  gstPercent?: string | undefined;
}

export interface QuotationLineAmounts {
  /** Amount after the line discount, before any tax split: qty × price less discount. */
  gross: string;
  /** The amount GST is charged on (the pre-tax value of the line). */
  taxable: string;
  gst: string;
  /** What the customer pays for the line: taxable + GST (exclusive) or gross (inclusive). */
  total: string;
}

export interface QuotationGstBreakdownRow {
  /** The rate, normalised without trailing zeros: "18", "12.5", "0.25". */
  rate: string;
  /** Σ taxable amounts of the lines at this rate. */
  taxable: string;
  /** Σ GST amounts of the lines at this rate. */
  gst: string;
}

export interface QuotationAmounts {
  lines: QuotationLineAmounts[];
  /** Σ taxable (pre-GST) amounts. */
  subtotal: string;
  /** One row per distinct GST rate used, lowest rate first. */
  gstBreakdown: QuotationGstBreakdownRow[];
  /** Σ GST across all rates. */
  taxAmount: string;
  /** Σ line totals. */
  total: string;
}

/** "18.00" -> "18", "12.50" -> "12.5", "0.25" -> "0.25", "0.00" / "" -> "0". */
export function normalizePercent(value: string | undefined): string {
  const text = (value ?? '').trim();
  if (text === '') return '0';
  const [integerRaw = '0', fractionRaw = ''] = text.split('.');
  const integer = integerRaw.replace(/^0+(?=\d)/, '') || '0';
  const fraction = fractionRaw.replace(/0+$/, '');
  return fraction ? `${integer}.${fraction}` : integer;
}

/** Parses a plain non-negative decimal with at most `places` decimals into an integer scaled by 10^places. */
function toScaled(value: string | undefined, places: number, label: string): bigint {
  const text = (value ?? '').trim() || '0';
  const match = /^(\d+)(?:\.(\d*))?$/.exec(text);
  if (!match || (match[2] ?? '').length > places) {
    throw new RangeError(`quotation money: ${label} must be a plain decimal with at most ${places} decimal places, got "${value}"`);
  }
  return BigInt(match[1]! + (match[2] ?? '').padEnd(places, '0'));
}

/** Half-up integer division for non-negative numbers. */
function divRoundHalfUp(numerator: bigint, denominator: bigint): bigint {
  return (numerator * 2n + denominator) / (denominator * 2n);
}

/** Integer paise -> "1234.50". */
function centsToString(cents: bigint): string {
  const whole = cents / 100n;
  const fraction = (cents % 100n).toString().padStart(2, '0');
  return `${whole}.${fraction}`;
}

function toCents(value: string): bigint {
  return toScaled(value, 2, 'amount');
}

export function calculateQuotationAmounts(lines: readonly QuotationMoneyLine[], pricesIncludeTax: boolean): QuotationAmounts {
  const lineAmounts: QuotationLineAmounts[] = [];
  const breakdown = new Map<string, { rateScaled: bigint; taxable: bigint; gst: bigint }>();
  let subtotal = 0n;
  let taxAmount = 0n;
  let total = 0n;

  for (const line of lines) {
    const quantity = toScaled(line.quantity, 2, 'quantity'); //   ×100
    const unitPrice = toScaled(line.unitPrice, 2, 'unit price'); // ×100
    const discount = toScaled(line.discountPercent, 2, 'discount percent'); // ×100 (percent)
    const rate = toScaled(line.gstPercent, 2, 'GST percent'); //   ×100 (percent)
    if (discount > 10000n) throw new RangeError('quotation money: discount percent cannot be more than 100');
    if (rate > 10000n) throw new RangeError('quotation money: GST percent cannot be more than 100');

    // quantity/100 × price/100 × (10000 − discount)/10000, as paise: divide by 10^6.
    const gross = divRoundHalfUp(quantity * unitPrice * (10000n - discount), 1_000_000n);

    let taxable: bigint;
    let gst: bigint;
    let lineTotal: bigint;
    if (pricesIncludeTax) {
      taxable = divRoundHalfUp(gross * 10000n, 10000n + rate);
      gst = gross - taxable;
      lineTotal = gross;
    } else {
      taxable = gross;
      gst = divRoundHalfUp(taxable * rate, 10000n);
      lineTotal = taxable + gst;
    }

    lineAmounts.push({
      gross: centsToString(gross),
      taxable: centsToString(taxable),
      gst: centsToString(gst),
      total: centsToString(lineTotal),
    });
    subtotal += taxable;
    taxAmount += gst;
    total += lineTotal;

    const key = normalizePercent(line.gstPercent);
    const row = breakdown.get(key) ?? { rateScaled: rate, taxable: 0n, gst: 0n };
    row.taxable += taxable;
    row.gst += gst;
    breakdown.set(key, row);
  }

  const gstBreakdown = [...breakdown.entries()]
    .sort(([, a], [, b]) => (a.rateScaled < b.rateScaled ? -1 : a.rateScaled > b.rateScaled ? 1 : 0))
    .map(([rate, row]) => ({ rate, taxable: centsToString(row.taxable), gst: centsToString(row.gst) }));

  return {
    lines: lineAmounts,
    subtotal: centsToString(subtotal),
    gstBreakdown,
    taxAmount: centsToString(taxAmount),
    total: centsToString(total),
  };
}

/**
 * Groups already-calculated (stored) line amounts by GST rate, in the same
 * shape the calculator returns. Used when reading a saved quotation, so the
 * breakdown printed on screen and in the PDF is built from the stored line
 * values and can never drift from them.
 */
export function groupGstByRate(
  lines: readonly { gstPercent: string; taxableAmount: string; gstAmount: string }[],
): QuotationGstBreakdownRow[] {
  const breakdown = new Map<string, { rateScaled: bigint; taxable: bigint; gst: bigint }>();
  for (const line of lines) {
    const key = normalizePercent(line.gstPercent);
    const row = breakdown.get(key) ?? { rateScaled: toScaled(line.gstPercent, 2, 'GST percent'), taxable: 0n, gst: 0n };
    row.taxable += toCents(line.taxableAmount);
    row.gst += toCents(line.gstAmount);
    breakdown.set(key, row);
  }
  return [...breakdown.entries()]
    .sort(([, a], [, b]) => (a.rateScaled < b.rateScaled ? -1 : a.rateScaled > b.rateScaled ? 1 : 0))
    .map(([rate, row]) => ({ rate, taxable: centsToString(row.taxable), gst: centsToString(row.gst) }));
}
