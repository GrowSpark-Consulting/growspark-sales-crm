/**
 * A small RFC 4180 CSV reader for imports (D95), the counterpart of csv.ts's
 * writer. No dependency, no evaluation of anything: every cell comes back as
 * the exact text between the delimiters.
 *
 * - A leading UTF-8 byte-order mark is removed (Excel writes one).
 * - Records end at CRLF, LF or a lone CR (old Mac exports).
 * - A field wrapped in double quotes may contain commas, line breaks and
 *   doubled quotes ("" → "). A quote in the middle of an unquoted field, or
 *   text after a closing quote, is kept literally rather than rejected —
 *   lenient on purpose, since hand-edited spreadsheets do this.
 * - A quoted field still open at the end of the file is an error (the file
 *   is almost certainly truncated or broken; guessing would shift columns).
 * - Comma is the only delimiter.
 */

export class CsvParseError extends Error {}

export interface ParsedCsv {
  /** Every record, including blank ones, in file order. */
  records: string[][];
}

const BOM = '﻿';

export function parseCsv(input: string): ParsedCsv {
  const text = input.startsWith(BOM) ? input.slice(1) : input;
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let inQuotes = false;
  let fieldStarted = false; // true once the current field has any content or an opening quote
  let quotedRecordStartLine = 0;
  let line = 1;

  const endField = () => {
    record.push(field);
    field = '';
    fieldStarted = false;
  };
  const endRecord = () => {
    endField();
    records.push(record);
    record = [];
  };

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]!;

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        if (char === '\n' || (char === '\r' && text[i + 1] !== '\n')) line += 1;
        field += char;
      }
      continue;
    }

    if (char === '"' && !fieldStarted) {
      inQuotes = true;
      fieldStarted = true;
      quotedRecordStartLine = line;
    } else if (char === ',') {
      endField();
    } else if (char === '\r' || char === '\n') {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      line += 1;
      endRecord();
    } else {
      field += char;
      fieldStarted = true;
    }
  }

  if (inQuotes) {
    throw new CsvParseError(
      `A quoted value starting on line ${quotedRecordStartLine} is never closed — the file may be cut off or damaged.`,
    );
  }
  // The last record, unless the file ended with a line break (no empty trailing record).
  if (field !== '' || fieldStarted || record.length > 0) endRecord();

  return { records };
}

export function isBlankRecord(record: readonly string[]): boolean {
  return record.every((cell) => cell.trim() === '');
}
