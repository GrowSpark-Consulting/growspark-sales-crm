/**
 * A small RFC4180-style CSV writer, plus a defence against CSV/spreadsheet
 * formula injection: a cell whose first character is one of =, +, -, @, a
 * tab, or a carriage return is prefixed with a single quote, which Excel,
 * Google Sheets, and LibreOffice all treat as "force this cell to plain
 * text" rather than evaluating it as a formula when the file is opened.
 */

const FORMULA_TRIGGER_CHARS = new Set(['=', '+', '-', '@', '\t', '\r']);

export function neutralizeFormulaInjection(value: string): string {
  if (value.length === 0) return value;
  return FORMULA_TRIGGER_CHARS.has(value[0]!) ? `'${value}` : value;
}

/**
 * The exact inverse, for CSV import (D95): drops the single quote that
 * neutralizeFormulaInjection (or a person in Excel) put in front of a
 * trigger character, so this app's own exports — "'+91 98400 12345" —
 * re-import as "+91 98400 12345". The result is stored as plain text and
 * neutralised again on any later export; nothing is ever evaluated.
 */
export function restoreNeutralizedCell(value: string): string {
  return value.length > 1 && value[0] === "'" && FORMULA_TRIGGER_CHARS.has(value[1]!) ? value.slice(1) : value;
}

/** Wraps in double quotes (doubling any internal quotes) if the value contains a comma, a quote, or a line break — the one escaping rule RFC4180 requires. */
function quoteCsvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

/** Converts one value into its final CSV cell text: stringified, formula-neutralized, then RFC4180-quoted, in that order. */
export function csvCell(value: unknown): string {
  return quoteCsvField(neutralizeFormulaInjection(cellToString(value)));
}

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => unknown;
}

/** Matches the 5-day roadmap's own export cap (Day 5 / Part C, item J). */
export const CSV_EXPORT_ROW_LIMIT = 10_000;

/**
 * The UTF-8 byte-order mark. Without it, Excel on Windows guesses a CSV's
 * encoding from its raw bytes and can misread non-ASCII characters (e.g.
 * the rupee sign) as the wrong codepage; a leading BOM tells it, and every
 * other reader that understands UTF-8, exactly what encoding this is.
 */
const UTF8_BOM = '﻿';

/**
 * A real bug, found in manual testing: Excel on Windows has a long-standing
 * misdetection where, if a file's very first cell is the bare two-letter
 * text "ID", Excel guesses the file is an old SYLK spreadsheet format
 * instead of CSV/text, and refuses to open it ("Excel has detected that
 * the file is a SYLK file, but cannot load it") — this is a real-world
 * Excel quirk, not specific to this app, but every one of this app's
 * exports started their header row with a bare "ID" column. Guarded here,
 * not just fixed at each call site, so the mistake can never quietly come
 * back: any column list whose first header is exactly "ID" (any case)
 * fails loudly at the point rowsToCsv is called, rather than shipping a
 * file Excel can't open.
 */
function assertFirstHeaderIsNotBareId<T>(columns: readonly CsvColumn<T>[]): void {
  const first = columns[0]?.header.trim();
  if (first && first.toUpperCase() === 'ID') {
    throw new Error(
      `rowsToCsv: the first column's header is the bare text "${columns[0]!.header}". ` +
        'Excel on Windows misdetects a CSV whose first cell is exactly "ID" as an old SYLK ' +
        'file and refuses to open it. Use a more specific header (e.g. "Lead ID") or move the ' +
        'id column so it is not first.',
    );
  }
}

/**
 * Builds a complete CSV document (header row + one row per item),
 * CRLF-terminated per RFC4180, with a leading UTF-8 BOM so Excel opens it
 * correctly. Throws rather than silently shipping a file Excel's SYLK
 * misdetection would refuse to open — see assertFirstHeaderIsNotBareId.
 */
export function rowsToCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
  assertFirstHeaderIsNotBareId(columns);
  const headerLine = columns.map((column) => csvCell(column.header)).join(',');
  const dataLines = rows.map((row) => columns.map((column) => csvCell(column.value(row))).join(','));
  return UTF8_BOM + [headerLine, ...dataLines].join('\r\n') + '\r\n';
}
