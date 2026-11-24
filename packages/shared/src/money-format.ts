/**
 * Exact, string-based Indian-grouped money formatting for amounts that must
 * show paise (quotation totals): "1234567.5" -> "12,34,567.50". Works on the
 * decimal string the API returns, never on a JS number, so no float
 * conversion can ever change a digit. Shared by the quotation PDF (server)
 * and the quotation screens (web) so both always print identical text (D85).
 */
export function formatIndianDecimal(amount: string): string {
  const trimmed = amount.trim();
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(trimmed);
  if (!match) {
    throw new RangeError(`formatIndianDecimal: not a plain decimal string: "${amount}"`);
  }
  const [, sign, rawInteger, rawFraction = ''] = match;
  if (rawFraction.length > 2) {
    throw new RangeError(`formatIndianDecimal: more than 2 decimal places: "${amount}"`);
  }
  const integer = rawInteger!.replace(/^0+(?=\d)/, '');
  const fraction = rawFraction.padEnd(2, '0');

  let grouped: string;
  if (integer.length <= 3) {
    grouped = integer;
  } else {
    const lastThree = integer.slice(-3);
    const rest = integer.slice(0, -3);
    grouped = `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${lastThree}`;
  }
  const isZero = /^0+$/.test(integer) && /^0+$/.test(fraction);
  return `${isZero ? '' : sign}${grouped}.${fraction}`;
}

/** formatIndianDecimal with the rupee sign: "₹ 12,34,567.50". */
export function formatRupees(amount: string): string {
  return `₹ ${formatIndianDecimal(amount)}`;
}
