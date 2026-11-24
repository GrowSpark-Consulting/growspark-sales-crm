import { describe, expect, it } from 'vitest';
import { csvCell, neutralizeFormulaInjection, rowsToCsv } from '../../src/lib/csv.js';

describe('neutralizeFormulaInjection', () => {
  it('leaves an ordinary value untouched', () => {
    expect(neutralizeFormulaInjection('Asha Rao')).toBe('Asha Rao');
  });

  it('leaves an empty string untouched', () => {
    expect(neutralizeFormulaInjection('')).toBe('');
  });

  for (const trigger of ['=', '+', '-', '@', '\t', '\r']) {
    it(`prefixes a value starting with ${JSON.stringify(trigger)} with a single quote`, () => {
      const value = `${trigger}cmd|'/C calc'!A1`;
      expect(neutralizeFormulaInjection(value)).toBe(`'${value}`);
    });
  }

  it('does not touch a value where the trigger character appears later, not first', () => {
    expect(neutralizeFormulaInjection('Total=100')).toBe('Total=100');
  });
});

describe('csvCell', () => {
  it('stringifies null and undefined as an empty string', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
  });

  it('stringifies a Date as its ISO string', () => {
    const date = new Date('2026-11-24T10:00:00.000Z');
    expect(csvCell(date)).toBe('2026-11-24T10:00:00.000Z');
  });

  it('stringifies a number and a boolean', () => {
    expect(csvCell(42)).toBe('42');
    expect(csvCell(true)).toBe('true');
  });

  it('quotes a value containing a comma', () => {
    expect(csvCell('Example Foods, Pvt Ltd')).toBe('"Example Foods, Pvt Ltd"');
  });

  it('quotes a value containing a double quote, doubling it', () => {
    expect(csvCell('She said "hello"')).toBe('"She said ""hello"""');
  });

  it('quotes a value containing a newline', () => {
    expect(csvCell('line one\nline two')).toBe('"line one\nline two"');
  });

  it('leaves a plain value unquoted', () => {
    expect(csvCell('Asha Rao')).toBe('Asha Rao');
  });

  it('neutralizes a formula-injection attempt before quoting, when the value also needs quoting', () => {
    // Starts with "=" (formula trigger) AND contains a comma (quoting trigger) —
    // both defences must apply, in the right order (neutralize, then quote).
    expect(csvCell('=1+1,2')).toBe('"\'=1+1,2"');
  });

  it('does not quote a formula-neutralized value that has no comma/quote/newline', () => {
    expect(csvCell('=SUM(A1:A2)')).toBe("'=SUM(A1:A2)");
  });
});

const BOM = '﻿';

describe('rowsToCsv', () => {
  interface Row {
    name: string;
    note: string | null;
  }

  it('builds a header row plus one line per item, CRLF-terminated, with a leading UTF-8 BOM', () => {
    const rows: Row[] = [
      { name: 'Asha Rao', note: 'VIP' },
      { name: 'Example Foods, Pvt Ltd', note: null },
    ];
    const csv = rowsToCsv(rows, [
      { header: 'Name', value: (r) => r.name },
      { header: 'Note', value: (r) => r.note },
    ]);

    expect(csv).toBe(`${BOM}Name,Note\r\nAsha Rao,VIP\r\n"Example Foods, Pvt Ltd",\r\n`);
  });

  it('produces just a header line (with the BOM and a trailing CRLF) for an empty row set', () => {
    const csv = rowsToCsv([] as Row[], [{ header: 'Name', value: (r) => r.name }]);
    expect(csv).toBe(`${BOM}Name\r\n`);
  });

  it('neutralizes a formula-injection attempt in a real column value', () => {
    const rows: Row[] = [{ name: '=HYPERLINK("http://evil.test")', note: null }];
    const csv = rowsToCsv(rows, [{ header: 'Name', value: (r) => r.name }]);
    expect(csv).toContain("'=HYPERLINK");
  });

  it('starts with the BOM, never with the bare letters "ID" (the Excel SYLK misdetection)', () => {
    const csv = rowsToCsv([] as Row[], [{ header: 'Name', value: (r) => r.name }]);
    expect(csv.startsWith(BOM)).toBe(true);
    const afterBom = csv.slice(BOM.length);
    expect(afterBom.slice(0, 2)).not.toBe('ID');
  });

  it('still handles quotes, commas, and newlines correctly with the BOM present', () => {
    const rows: Row[] = [{ name: 'Quote " and, comma', note: 'line one\nline two' }];
    const csv = rowsToCsv(rows, [
      { header: 'Name', value: (r) => r.name },
      { header: 'Note', value: (r) => r.note },
    ]);
    expect(csv).toBe(`${BOM}Name,Note\r\n"Quote "" and, comma","line one\nline two"\r\n`);
  });

  describe('the Excel SYLK-misdetection guard', () => {
    it('throws when the first column header is the bare text "ID"', () => {
      expect(() => rowsToCsv([], [{ header: 'ID', value: () => '' }])).toThrow(/SYLK/);
    });

    it('throws regardless of case or surrounding whitespace', () => {
      expect(() => rowsToCsv([], [{ header: 'id', value: () => '' }])).toThrow(/SYLK/);
      expect(() => rowsToCsv([], [{ header: ' Id ', value: () => '' }])).toThrow(/SYLK/);
    });

    it('does not throw for a descriptive id-like header, or when "ID" is not first', () => {
      expect(() =>
        rowsToCsv([], [
          { header: 'Lead ID', value: () => '' },
          { header: 'Name', value: () => '' },
        ]),
      ).not.toThrow();
      expect(() =>
        rowsToCsv([], [
          { header: 'Name', value: () => '' },
          { header: 'ID', value: () => '' },
        ]),
      ).not.toThrow();
    });
  });
});
