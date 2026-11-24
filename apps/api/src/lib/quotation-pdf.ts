import PDFDocument from 'pdfkit';
import { fileURLToPath } from 'node:url';
import { formatIndianDecimal, formatRupees, matchCountryCallingCode, type QuotationResponse, type QuotationStatus } from '@growspark/shared';

/**
 * Quotation PDF (D84/D85): generated on demand from the quotation's own data,
 * held in memory only for the length of one request, never written to disk
 * and never stored. pdfkit (pure JavaScript, no headless browser). Noto Sans
 * (SIL OFL 1.1, apps/api/assets/fonts/OFL.txt) is embedded because the PDF
 * standard fonts have no rupee sign.
 *
 * Two layers on purpose: buildQuotationPdfModel() turns the data into the
 * exact strings that get printed (pure, unit-tested — every money value goes
 * through the same shared formatter the screens use), and
 * renderQuotationPdf() only lays that model out on the page.
 */

// src/lib/ and dist/lib/ are both two levels below apps/api/, so this
// resolves to apps/api/assets/fonts in dev (tsx), tests and the built app.
const FONT_DIR = new URL('../../assets/fonts/', import.meta.url);
export const PDF_FONT_REGULAR = fileURLToPath(new URL('NotoSans-Regular.ttf', FONT_DIR));
export const PDF_FONT_BOLD = fileURLToPath(new URL('NotoSans-Bold.ttf', FONT_DIR));

export interface PdfSeller {
  name: string;
  legalName: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  gstin: string | null;
}

export interface PdfBuyerCompany {
  name: string;
  legalName: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
}

export interface PdfBuyerContact {
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
}

export interface QuotationPdfInput {
  quotation: QuotationResponse;
  organization: PdfSeller;
  company: PdfBuyerCompany;
  contact: PdfBuyerContact;
}

export interface QuotationPdfModel {
  title: string;
  reference: string;
  seller: { name: string; lines: string[] };
  meta: { label: string; value: string }[];
  buyer: { name: string; lines: string[] };
  items: { index: string; description: string; quantity: string; unitPrice: string; discount: string; amount: string }[];
  totals: { label: string; value: string; strong?: boolean }[];
  terms: string | null;
  notes: string | null;
  /** Plain-ASCII summary written into the PDF's document info (searchable, and checked by tests). */
  keywords: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-11-24" -> "24 Nov 2026" — the same text the screens' formatDate() produces, without any time-zone conversion. */
export function formatDateKey(key: string): string {
  const [year, month, day] = key.split('-').map(Number);
  return `${day} ${MONTHS[month! - 1]} ${year}`;
}

const STATUS_LABELS: Record<QuotationStatus, string> = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  EXPIRED: 'Expired',
};

function formatPhone(value: string | null): string | null {
  if (!value) return null;
  const match = matchCountryCallingCode(value);
  if (!match) return value;
  const national = value.slice(match.code.length);
  return match.code === '+91' && national.length === 10
    ? `${match.code} ${national.slice(0, 5)} ${national.slice(5)}`
    : `${match.code} ${national}`;
}

/** "18.00" -> "18", "33.33" -> "33.33", "2.50" -> "2.5" — percentages and quantities read better without trailing zeros. */
function trimDecimal(value: string): string {
  return value.includes('.') ? value.replace(/0+$/, '').replace(/\.$/, '') : value;
}

function compact(values: (string | null | undefined)[]): string[] {
  return values.map((value) => value?.trim()).filter((value): value is string => Boolean(value));
}

function addressLines(party: { addressLine1: string | null; addressLine2: string | null; city: string | null; state: string | null; postalCode: string | null; country: string | null }): string[] {
  const cityLine = compact([party.city, party.state]).join(', ');
  const placeLine = compact([cityLine, party.postalCode]).join(' ');
  return compact([party.addressLine1, party.addressLine2, placeLine, party.country]);
}

export function buildQuotationPdfModel({ quotation, organization, company, contact }: QuotationPdfInput): QuotationPdfModel {
  const sellerName = organization.legalName || organization.name;
  const contactName = compact([contact.firstName, contact.lastName]).join(' ');
  const discountPercent = trimDecimal(quotation.discountPercent);
  const taxPercent = trimDecimal(quotation.taxPercent);
  const hasDiscount = quotation.discountAmount !== '0.00';

  return {
    title: 'Quotation',
    reference: quotation.pdfReference,
    seller: {
      name: sellerName,
      lines: compact([
        ...addressLines(organization),
        compact([formatPhone(organization.phone), organization.email]).join('  ·  '),
        organization.website,
        organization.gstin ? `GSTIN: ${organization.gstin}` : null,
      ]),
    },
    meta: [
      { label: 'Quotation no.', value: quotation.number },
      { label: 'Reference', value: quotation.pdfReference },
      { label: 'Issue date', value: formatDateKey(quotation.issueDate) },
      { label: 'Valid until', value: formatDateKey(quotation.validUntil) },
      { label: 'Status', value: STATUS_LABELS[quotation.status] },
      ...(quotation.dealName ? [{ label: 'Deal', value: quotation.dealName }] : []),
    ],
    buyer: {
      name: company.legalName || company.name,
      lines: compact([
        ...addressLines(company),
        contactName ? `Attn: ${contactName}` : null,
        compact([formatPhone(contact.phone), contact.email]).join('  ·  '),
      ]),
    },
    items: (quotation.lineItems ?? []).map((item) => ({
      index: String(item.position),
      description: item.description,
      quantity: trimDecimal(item.quantity),
      unitPrice: formatIndianDecimal(item.unitPrice),
      discount: item.discountPercent === '0.00' ? '—' : `${trimDecimal(item.discountPercent)}%`,
      amount: formatIndianDecimal(item.lineTotal),
    })),
    totals: [
      { label: 'Subtotal', value: formatRupees(quotation.subtotal) },
      ...(hasDiscount
        ? [
            { label: `Discount (${discountPercent}%)`, value: `− ${formatRupees(quotation.discountAmount)}` },
            { label: 'Taxable amount', value: formatRupees(quotation.taxableAmount) },
          ]
        : []),
      { label: `GST (${taxPercent}%)`, value: formatRupees(quotation.taxAmount) },
      { label: 'Total', value: formatRupees(quotation.total), strong: true },
    ],
    terms: quotation.terms,
    notes: quotation.notes,
    keywords: `${quotation.pdfReference}; total ${quotation.currency} ${quotation.total}`,
  };
}

const INK = '#111111';
const MUTED = '#666666';
const LINE = '#dddddd';
const HEADER_FILL = '#f2f2f2';

const COLUMNS = [
  { key: 'index', label: '#', width: 24, align: 'left' },
  { key: 'description', label: 'Description', width: 213, align: 'left' },
  { key: 'quantity', label: 'Qty', width: 44, align: 'right' },
  { key: 'unitPrice', label: 'Unit price (₹)', width: 80, align: 'right' },
  { key: 'discount', label: 'Disc.', width: 44, align: 'right' },
  { key: 'amount', label: 'Amount (₹)', width: 90, align: 'right' },
] as const;

/** Renders the model to a complete PDF in memory (a few KB) and resolves with its bytes. */
export function renderQuotationPdf(model: QuotationPdfModel): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 60, left: 50, right: 50 },
      bufferPages: true,
      info: { Title: `${model.title} ${model.reference}`, Subject: model.title, Keywords: model.keywords, Creator: 'Grow Spark Sales & CRM' },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.registerFont('Body', PDF_FONT_REGULAR);
    doc.registerFont('Bold', PDF_FONT_BOLD);

    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const contentWidth = right - left;
    const bottomLimit = () => doc.page.height - doc.page.margins.bottom;

    // Header: seller on the left, title + meta on the right.
    const headerTop = doc.y;
    doc.font('Bold').fontSize(15).fillColor(INK).text(model.seller.name, left, headerTop, { width: 300 });
    doc.font('Body').fontSize(9).fillColor(MUTED);
    for (const line of model.seller.lines) doc.text(line, { width: 300 });
    const sellerBottom = doc.y;

    const metaX = right - 200;
    doc.font('Bold').fontSize(20).fillColor(INK).text(model.title.toUpperCase(), metaX, headerTop, { width: 200, align: 'right' });
    doc.moveDown(0.3);
    for (const { label, value } of model.meta) {
      const y = doc.y;
      doc.font('Body').fontSize(9).fillColor(MUTED).text(label, metaX, y, { width: 80 });
      doc.font('Bold').fontSize(9).fillColor(INK).text(value, metaX + 80, y, { width: 120, align: 'right' });
    }
    doc.y = Math.max(sellerBottom, doc.y) + 18;

    doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor(LINE).lineWidth(1).stroke();
    doc.y += 12;

    // Bill to.
    doc.font('Body').fontSize(8).fillColor(MUTED).text('BILL TO', left, doc.y);
    doc.font('Bold').fontSize(11).fillColor(INK).text(model.buyer.name, left, doc.y + 2, { width: contentWidth });
    doc.font('Body').fontSize(9).fillColor(INK);
    for (const line of model.buyer.lines) doc.text(line, { width: contentWidth });
    doc.y += 16;

    // Line items table.
    const drawTableHeader = () => {
      const y = doc.y;
      doc.rect(left, y, contentWidth, 20).fill(HEADER_FILL);
      let x = left;
      doc.font('Bold').fontSize(8.5).fillColor(INK);
      for (const column of COLUMNS) {
        doc.text(column.label, x + 4, y + 6, { width: column.width - 8, align: column.align });
        x += column.width;
      }
      doc.y = y + 20;
    };
    drawTableHeader();

    doc.font('Body').fontSize(9);
    for (const item of model.items) {
      const descriptionColumn = COLUMNS[1];
      const rowHeight = Math.max(doc.heightOfString(item.description, { width: descriptionColumn.width - 8 }), 11) + 10;
      if (doc.y + rowHeight > bottomLimit()) {
        doc.addPage();
        drawTableHeader();
        doc.font('Body').fontSize(9);
      }
      const y = doc.y;
      let x = left;
      for (const column of COLUMNS) {
        doc.fillColor(INK).text(item[column.key], x + 4, y + 5, { width: column.width - 8, align: column.align });
        x += column.width;
      }
      doc.moveTo(left, y + rowHeight).lineTo(right, y + rowHeight).strokeColor(LINE).lineWidth(0.5).stroke();
      doc.y = y + rowHeight;
    }

    // Totals, right-aligned under the table.
    doc.y += 10;
    const totalsHeight = model.totals.length * 18 + 10;
    if (doc.y + totalsHeight > bottomLimit()) doc.addPage();
    const totalsX = right - 230;
    for (const row of model.totals) {
      const y = doc.y;
      if (row.strong) {
        doc.moveTo(totalsX, y - 3).lineTo(right, y - 3).strokeColor(INK).lineWidth(0.8).stroke();
      }
      doc.font(row.strong ? 'Bold' : 'Body').fontSize(row.strong ? 11 : 9.5).fillColor(INK);
      doc.text(row.label, totalsX, y + 1, { width: 120 });
      doc.text(row.value, totalsX + 120, y + 1, { width: 110, align: 'right' });
      doc.y = y + 18;
    }

    // Terms and notes.
    for (const [heading, body] of [['Terms', model.terms], ['Notes', model.notes]] as const) {
      if (!body) continue;
      doc.y += 14;
      if (doc.y + 40 > bottomLimit()) doc.addPage();
      doc.font('Bold').fontSize(9.5).fillColor(INK).text(heading, left, doc.y, { width: contentWidth });
      doc.font('Body').fontSize(9).fillColor(INK).text(body, left, doc.y + 2, { width: contentWidth });
    }

    // Footer on every page. The bottom margin is lifted while writing it,
    // otherwise pdfkit would treat text below the margin as overflow and
    // start a new page.
    const range = doc.bufferedPageRange();
    for (let index = range.start; index < range.start + range.count; index += 1) {
      doc.switchToPage(index);
      const savedBottom = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc.font('Body').fontSize(8).fillColor(MUTED).text(
        `${model.reference}  ·  Page ${index - range.start + 1} of ${range.count}`,
        left,
        doc.page.height - 40,
        { width: contentWidth, align: 'center', lineBreak: false },
      );
      doc.page.margins.bottom = savedBottom;
    }

    doc.end();
  });
}
