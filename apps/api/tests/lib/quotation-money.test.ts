import { describe, expect, it } from 'vitest';
import { formatIndianDecimal, formatRupees } from '@growspark/shared';
import { calculateLineTotal, calculateQuotationTotals } from '../../src/lib/quotation-money.js';

describe('calculateLineTotal (round half-up to 2 dp, once per line)', () => {
  it('3 × 0.10 is exactly 0.30 (no float drift)', () => {
    expect(calculateLineTotal({ quantity: '3', unitPrice: '0.10' })).toBe('0.30');
  });

  it('100.00 less 33.33% is 66.67', () => {
    expect(calculateLineTotal({ quantity: '1', unitPrice: '100.00', discountPercent: '33.33' })).toBe('66.67');
  });

  it('rounds an exact half up, not to even: 0.05 less 50% = 0.025 -> 0.03', () => {
    expect(calculateLineTotal({ quantity: '1', unitPrice: '0.05', discountPercent: '50' })).toBe('0.03');
  });

  it('fractional quantity: 2.5 × 19.99 = 49.975 -> 49.98', () => {
    expect(calculateLineTotal({ quantity: '2.5', unitPrice: '19.99' })).toBe('49.98');
  });

  it('a 100% line discount is zero, not negative', () => {
    expect(calculateLineTotal({ quantity: '4', unitPrice: '250.00', discountPercent: '100' })).toBe('0.00');
  });
});

describe('calculateQuotationTotals', () => {
  it('3 × 0.10, 33.33% quotation discount, 18% GST', () => {
    // subtotal 0.30; discount 0.30 × 33.33% = 0.09999 -> 0.10; taxable 0.20;
    // tax 0.20 × 18% = 0.036 -> 0.04; total 0.24
    expect(calculateQuotationTotals([{ quantity: '3', unitPrice: '0.10' }], '33.33', '18')).toEqual({
      lineTotals: ['0.30'],
      subtotal: '0.30',
      discountAmount: '0.10',
      taxableAmount: '0.20',
      taxAmount: '0.04',
      total: '0.24',
    });
  });

  it('3 × 33.33 with a 33.33% quotation discount and 18% GST', () => {
    // 99.99; discount 33.326667 -> 33.33; taxable 66.66; tax 11.9988 -> 12.00; total 78.66
    expect(calculateQuotationTotals([{ quantity: '3', unitPrice: '33.33' }], '33.33', '18')).toEqual({
      lineTotals: ['99.99'],
      subtotal: '99.99',
      discountAmount: '33.33',
      taxableAmount: '66.66',
      taxAmount: '12.00',
      total: '78.66',
    });
  });

  it('mixed lines with per-line and quotation-level discounts', () => {
    // line 1: 3 × 0.10 less 33.33% = 0.20001 -> 0.20; line 2: 99.99
    // subtotal 100.19; discount 33.393327 -> 33.39; taxable 66.80; tax 12.024 -> 12.02; total 78.82
    expect(
      calculateQuotationTotals(
        [
          { quantity: '3', unitPrice: '0.10', discountPercent: '33.33' },
          { quantity: '1', unitPrice: '99.99' },
        ],
        '33.33',
        '18',
      ),
    ).toEqual({ lineTotals: ['0.20', '99.99'], subtotal: '100.19', discountAmount: '33.39', taxableAmount: '66.80', taxAmount: '12.02', total: '78.82' });
  });

  it('0.10 + 0.20 is exactly 0.30, the classic float trap', () => {
    const result = calculateQuotationTotals(
      [
        { quantity: '1', unitPrice: '0.10' },
        { quantity: '1', unitPrice: '0.20' },
      ],
      '0',
      '0',
    );
    expect(result.subtotal).toBe('0.30');
    expect(result.total).toBe('0.30');
  });

  it('the printed parts always add up: subtotal − discount + tax = total', () => {
    const result = calculateQuotationTotals(
      [
        { quantity: '7', unitPrice: '13.37', discountPercent: '12.5' },
        { quantity: '0.33', unitPrice: '999.99' },
        { quantity: '11', unitPrice: '0.07', discountPercent: '33.33' },
      ],
      '7.77',
      '18',
    );
    const cents = (value: string) => BigInt(value.replace('.', ''));
    expect(cents(result.subtotal) - cents(result.discountAmount) + cents(result.taxAmount)).toBe(cents(result.total));
    expect(result.lineTotals.reduce((sum, value) => sum + cents(value), 0n)).toBe(cents(result.subtotal));
  });

  it('handles the largest stored line (12 integer digits) without losing precision', () => {
    const result = calculateQuotationTotals([{ quantity: '1', unitPrice: '999999999999.99' }], '0', '0');
    expect(result.total).toBe('999999999999.99');
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
