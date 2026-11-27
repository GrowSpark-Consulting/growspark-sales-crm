import { describe, expect, it } from 'vitest';
import { formatIndianDecimal, formatRupees, groupGstByRate, normalizePercent } from '@growspark/shared';
import { Prisma } from '../../src/generated/prisma/client.js';
import { calculateQuotationAmounts } from '../../src/lib/quotation-money.js';

const line = (quantity: string, unitPrice: string, gstPercent: string, discountPercent?: string) => ({
  quantity,
  unitPrice,
  gstPercent,
  ...(discountPercent === undefined ? {} : { discountPercent }),
});

const cents = (value: string) => BigInt(value.replace('.', ''));

describe('calculateQuotationAmounts — tax exclusive (D101)', () => {
  it('1 × ₹1,000 @ 18% -> taxable 1000.00, GST 180.00, total 1180.00', () => {
    const result = calculateQuotationAmounts([line('1', '1000.00', '18')], false);
    expect(result.lines).toEqual([{ gross: '1000.00', taxable: '1000.00', gst: '180.00', total: '1180.00' }]);
    expect(result.subtotal).toBe('1000.00');
    expect(result.gstBreakdown).toEqual([{ rate: '18', taxable: '1000.00', gst: '180.00' }]);
    expect(result.taxAmount).toBe('180.00');
    expect(result.total).toBe('1180.00');
  });

  it('the line discount applies before GST', () => {
    // 2 × 45,000 less 10% = 81,000; GST 18% = 14,580; total 95,580
    const result = calculateQuotationAmounts([line('2', '45000.00', '18', '10')], false);
    expect(result.lines[0]).toEqual({ gross: '81000.00', taxable: '81000.00', gst: '14580.00', total: '95580.00' });
  });

  it('0% (exempt) is allowed and adds no tax', () => {
    const result = calculateQuotationAmounts([line('4', '250.00', '0', '10')], false);
    expect(result.total).toBe('900.00');
    expect(result.taxAmount).toBe('0.00');
    expect(result.gstBreakdown).toEqual([{ rate: '0', taxable: '900.00', gst: '0.00' }]);
  });

  it('a blank GST rate counts as 0, a free rate such as 0.25 works', () => {
    const blank = calculateQuotationAmounts([{ quantity: '1', unitPrice: '100.00' }], false);
    expect(blank.total).toBe('100.00');
    const quarter = calculateQuotationAmounts([line('1', '1000.00', '0.25')], false);
    expect(quarter.taxAmount).toBe('2.50');
    expect(quarter.gstBreakdown[0]!.rate).toBe('0.25');
  });

  it('3 × 0.10 is exactly 0.30 and 0.10 + 0.20 is exactly 0.30 (no float drift)', () => {
    expect(calculateQuotationAmounts([line('3', '0.10', '0')], false).total).toBe('0.30');
    expect(calculateQuotationAmounts([line('1', '0.10', '0'), line('1', '0.20', '0')], false).total).toBe('0.30');
  });

  it('rounds an exact half up, not to even: 0.05 less 50% = 0.025 -> 0.03', () => {
    expect(calculateQuotationAmounts([line('1', '0.05', '0', '50')], false).lines[0]!.gross).toBe('0.03');
  });

  it('a 100% line discount is zero', () => {
    expect(calculateQuotationAmounts([line('4', '250.00', '18', '100')], false).total).toBe('0.00');
  });

  it('rounds the GST half-up per line (0.50 @ 5% = 0.025 -> 0.03)', () => {
    expect(calculateQuotationAmounts([line('1', '0.50', '5')], false).lines[0]!.gst).toBe('0.03');
  });

  it('handles the largest stored line (12 integer digits) without losing precision', () => {
    expect(calculateQuotationAmounts([line('1', '999999999999.99', '0')], false).total).toBe('999999999999.99');
  });
});

describe('calculateQuotationAmounts — tax inclusive (D101)', () => {
  it('1 × ₹1,000 @ 18% -> taxable 847.46, GST 152.54, total 1000.00', () => {
    const result = calculateQuotationAmounts([line('1', '1000.00', '18')], true);
    expect(result.lines).toEqual([{ gross: '1000.00', taxable: '847.46', gst: '152.54', total: '1000.00' }]);
    expect(result.subtotal).toBe('847.46');
    expect(result.gstBreakdown).toEqual([{ rate: '18', taxable: '847.46', gst: '152.54' }]);
    expect(result.total).toBe('1000.00');
  });

  it('the total never changes with the rate — only the split does', () => {
    for (const rate of ['0', '5', '12', '18', '28', '0.25']) {
      expect(calculateQuotationAmounts([line('1', '1000.00', rate)], true).total).toBe('1000.00');
    }
  });

  it('0% inclusive: everything is taxable, no GST', () => {
    const result = calculateQuotationAmounts([line('1', '500.00', '0')], true);
    expect(result.lines[0]).toEqual({ gross: '500.00', taxable: '500.00', gst: '0.00', total: '500.00' });
  });
});

describe('calculateQuotationAmounts — mixed rates', () => {
  const lines = [line('1', '1000.00', '5'), line('2', '500.00', '12.5'), line('1', '200.00', '5')];

  it('exclusive: one breakdown row per distinct rate, lowest first, parts add up to the total', () => {
    const result = calculateQuotationAmounts(lines, false);
    expect(result.gstBreakdown).toEqual([
      { rate: '5', taxable: '1200.00', gst: '60.00' },
      { rate: '12.5', taxable: '1000.00', gst: '125.00' },
    ]);
    expect(result.subtotal).toBe('2200.00');
    expect(result.taxAmount).toBe('185.00');
    expect(result.total).toBe('2385.00');
  });

  it('inclusive: two breakdown rows, subtotal + GST = total', () => {
    const result = calculateQuotationAmounts(lines, true);
    expect(result.gstBreakdown).toHaveLength(2);
    expect(cents(result.subtotal) + cents(result.taxAmount)).toBe(cents(result.total));
    expect(result.total).toBe('2200.00');
  });

  it('"5" and "5.00" are the same rate (one row)', () => {
    const result = calculateQuotationAmounts([line('1', '100.00', '5'), line('1', '100.00', '5.00')], false);
    expect(result.gstBreakdown).toHaveLength(1);
    expect(result.gstBreakdown[0]!.gst).toBe('10.00');
  });

  it('groupGstByRate rebuilds the same breakdown from stored line amounts', () => {
    const result = calculateQuotationAmounts(lines, false);
    const stored = lines.map((item, index) => ({
      gstPercent: item.gstPercent === '12.5' ? '12.50' : `${item.gstPercent}.00`,
      taxableAmount: result.lines[index]!.taxable,
      gstAmount: result.lines[index]!.gst,
    }));
    expect(groupGstByRate(stored)).toEqual(result.gstBreakdown);
  });
});

describe('calculateQuotationAmounts — exactness against an independent decimal implementation', () => {
  // Decimal.js (bundled with Prisma) is the oracle: same rule, written differently.
  const D = Prisma.Decimal;
  const r2 = (value: InstanceType<typeof D>) => value.toDecimalPlaces(2, D.ROUND_HALF_UP);

  function oracle(item: { quantity: string; unitPrice: string; gstPercent: string; discountPercent: string }, inclusive: boolean) {
    const gross = r2(new D(item.quantity).times(item.unitPrice).times(new D(100).minus(item.discountPercent)).dividedBy(100));
    if (inclusive) {
      const taxable = r2(gross.dividedBy(new D(1).plus(new D(item.gstPercent).dividedBy(100))));
      return { taxable: taxable.toFixed(2), gst: gross.minus(taxable).toFixed(2), total: gross.toFixed(2) };
    }
    const gst = r2(gross.times(item.gstPercent).dividedBy(100));
    return { taxable: gross.toFixed(2), gst: gst.toFixed(2), total: gross.plus(gst).toFixed(2) };
  }

  // A tiny deterministic generator, so a failure is reproducible.
  let seed = 20261127;
  const next = (max: number) => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return Math.floor(seed / 65536) % max;
  };
  const two = () => String(next(100)).padStart(2, '0');

  it('matches on 2,000 random lines, exclusive and inclusive', () => {
    for (let i = 0; i < 2000; i += 1) {
      const item = {
        quantity: `${1 + next(50)}.${two()}`,
        unitPrice: `${next(100000)}.${two()}`,
        gstPercent: next(4) === 0 ? String(next(101)) : `${next(29)}.${two()}`,
        discountPercent: next(3) === 0 ? '0' : `${next(100)}.${two()}`,
      };
      for (const inclusive of [false, true]) {
        const got = calculateQuotationAmounts([item], inclusive).lines[0]!;
        const want = oracle(item, inclusive);
        expect({ taxable: got.taxable, gst: got.gst, total: got.total }, JSON.stringify({ item, inclusive })).toEqual(want);
      }
    }
  });

  it('subtotal + GST rows always equal the total to the paisa — many lines, mixed rates', () => {
    const rates = ['0', '5', '12', '18', '28', '12.5', '0.25'];
    const items = Array.from({ length: 40 }, () => ({
      quantity: `${1 + next(20)}.${two()}`,
      unitPrice: `${next(5000)}.${two()}`,
      gstPercent: rates[next(rates.length)]!,
      discountPercent: `${next(40)}.${two()}`,
    }));
    for (const inclusive of [false, true]) {
      const result = calculateQuotationAmounts(items, inclusive);
      const breakdownGst = result.gstBreakdown.reduce((sum, row) => sum + cents(row.gst), 0n);
      expect(breakdownGst).toBe(cents(result.taxAmount));
      expect(cents(result.subtotal) + cents(result.taxAmount)).toBe(cents(result.total));
      expect(result.lines.reduce((sum, item) => sum + cents(item.total), 0n)).toBe(cents(result.total));
    }
  });
});

describe('input handling', () => {
  it('rejects values that are not plain decimals with at most 2 places, or percentages over 100', () => {
    expect(() => calculateQuotationAmounts([line('1', '1.234', '18')], false)).toThrow(RangeError);
    expect(() => calculateQuotationAmounts([line('1', '10', '18.123')], false)).toThrow(RangeError);
    expect(() => calculateQuotationAmounts([line('1', '1e5', '18')], false)).toThrow(RangeError);
    expect(() => calculateQuotationAmounts([line('1', '10', '101')], false)).toThrow(RangeError);
    expect(() => calculateQuotationAmounts([line('1', '10', '18', '100.01')], false)).toThrow(RangeError);
  });

  it('normalizePercent drops trailing zeros', () => {
    expect([normalizePercent('18.00'), normalizePercent('12.50'), normalizePercent('0.25'), normalizePercent('0.00'), normalizePercent('')]).toEqual([
      '18',
      '12.5',
      '0.25',
      '0',
      '0',
    ]);
  });
});

describe('formatIndianDecimal / formatRupees (shared by the PDF and the screens)', () => {
  it.each([
    ['0', '0.00'],
    ['0.3', '0.30'],
    ['999', '999.00'],
    ['1000', '1,000.00'],
    ['100000', '1,00,000.00'],
    ['1234567.5', '12,34,567.50'],
    ['12345678901.23', '12,34,56,78,901.23'],
    ['-1234.5', '-1,234.50'],
    ['-0.00', '0.00'],
    ['007.10', '7.10'],
  ])('%s -> %s', (input, expected) => {
    expect(formatIndianDecimal(input)).toBe(expected);
  });

  it('adds the rupee sign', () => {
    expect(formatRupees('78.66')).toBe('₹ 78.66');
  });

  it('refuses anything that is not a plain decimal with at most 2 places', () => {
    expect(() => formatIndianDecimal('1.234')).toThrow(RangeError);
    expect(() => formatIndianDecimal('1e5')).toThrow(RangeError);
    expect(() => formatIndianDecimal('abc')).toThrow(RangeError);
  });
});
