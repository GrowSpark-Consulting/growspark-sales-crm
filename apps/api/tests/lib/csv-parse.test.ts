import { describe, expect, it } from 'vitest';
import { CsvParseError, isBlankRecord, parseCsv } from '../../src/lib/csv-parse.js';
import { rowsToCsv } from '../../src/lib/csv.js';

describe('parseCsv', () => {
  it('reads plain records with LF, CRLF and lone-CR line endings, with or without a final line break', () => {
    expect(parseCsv('a,b\n1,2\n').records).toEqual([['a', 'b'], ['1', '2']]);
    expect(parseCsv('a,b\r\n1,2').records).toEqual([['a', 'b'], ['1', '2']]);
    expect(parseCsv('a,b\r1,2\r').records).toEqual([['a', 'b'], ['1', '2']]);
  });

  it('removes a leading byte-order mark (Excel), so the first header is not "\\uFEFFName"', () => {
    expect(parseCsv('﻿Name,Email\nAsha,a@example.test').records[0]).toEqual(['Name', 'Email']);
  });

  it('handles quoted fields with commas, line breaks and doubled quotes', () => {
    const csv = 'name,notes\n"Rao, Asha","Line one\r\nLine ""two"""\n';
    expect(parseCsv(csv).records).toEqual([
      ['name', 'notes'],
      ['Rao, Asha', 'Line one\r\nLine "two"'],
    ]);
  });

  it('keeps empty fields, blank lines and trailing commas as they are', () => {
    const { records } = parseCsv('a,b,c\n,,\n\n1,,3,\n');
    expect(records).toEqual([['a', 'b', 'c'], ['', '', ''], [''], ['1', '', '3', '']]);
    expect(isBlankRecord(records[1]!)).toBe(true);
    expect(isBlankRecord(records[2]!)).toBe(true);
    expect(isBlankRecord(records[3]!)).toBe(false);
  });

  it('is lenient with a stray quote inside an unquoted field, and with text after a closing quote', () => {
    expect(parseCsv('5" screen,x\n').records).toEqual([['5" screen', 'x']]);
    expect(parseCsv('"abc"def,x\n').records).toEqual([['abcdef', 'x']]);
  });

  it('never evaluates anything: formula-like text comes back exactly as written', () => {
    const { records } = parseCsv('=HYPERLINK("http://example.test","x"),+91,@SUM(A1),-2\n');
    // The second cell starts with a quote, so it is read as the quoted value "x" followed by a literal ")".
    expect(records[0]).toEqual(['=HYPERLINK("http://example.test"', 'x)', '+91', '@SUM(A1)', '-2']);
    expect(parseCsv('"=HYPERLINK(""http://example.test"",""x"")"\n').records[0]).toEqual([
      '=HYPERLINK("http://example.test","x")',
    ]);
  });

  it('refuses a quoted value that is never closed, naming the line it started on', () => {
    expect(() => parseCsv('a,b\n1,"unterminated\n2,3\n')).toThrow(CsvParseError);
    expect(() => parseCsv('a,b\n1,"unterminated\n2,3\n')).toThrow(/line 2/);
  });

  it('round-trips the app’s own CSV writer (BOM, quoting, formula neutralising)', () => {
    const written = rowsToCsv(
      [{ name: 'Rao, Asha', note: 'say "hi"\nthen go' }],
      [
        { header: 'Name', value: (row: { name: string; note: string }) => row.name },
        { header: 'Note', value: (row: { name: string; note: string }) => row.note },
      ],
    );
    expect(parseCsv(written).records).toEqual([
      ['Name', 'Note'],
      ['Rao, Asha', 'say "hi"\nthen go'],
    ]);
  });

  it('returns nothing for an empty file', () => {
    expect(parseCsv('').records).toEqual([]);
    expect(parseCsv('﻿').records).toEqual([]);
  });
});

describe('restoreNeutralizedCell (import side of the formula guard)', () => {
  it('drops only the quote the writer adds before a trigger character, and is the exact inverse of it', async () => {
    const { neutralizeFormulaInjection, restoreNeutralizedCell } = await import('../../src/lib/csv.js');
    expect(restoreNeutralizedCell("'+91 98400 12345")).toBe('+91 98400 12345');
    expect(restoreNeutralizedCell("'=SUM(A1)")).toBe('=SUM(A1)');
    expect(restoreNeutralizedCell("'@x")).toBe('@x');
    expect(restoreNeutralizedCell("'-2")).toBe('-2');
    // Not added by the writer: left alone.
    expect(restoreNeutralizedCell("'Hello")).toBe("'Hello");
    expect(restoreNeutralizedCell("'")).toBe("'");
    expect(restoreNeutralizedCell("O'Brien")).toBe("O'Brien");
    for (const value of ['+91', '=1+1', '@a', '-x', 'plain', "'quoted"]) {
      expect(restoreNeutralizedCell(neutralizeFormulaInjection(value))).toBe(value);
    }
  });
});
