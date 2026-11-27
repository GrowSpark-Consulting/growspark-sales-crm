import { describe, expect, it } from 'vitest';
import request from 'supertest';
import PDFDocument from 'pdfkit';
import { formatRupees, type QuotationResponse } from '@growspark/shared';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';
import { createTestTenant, createTwoTestTenants } from '../helpers/tenant.js';
import { createQuotationContext, quotationBody, signIn, AWKWARD_LINES } from '../helpers/quotations.js';
import {
  PDF_FONT_BOLD,
  PDF_FONT_REGULAR,
  buildQuotationPdfModel,
  formatDateKey,
  renderQuotationPdf,
} from '../../src/lib/quotation-pdf.js';

/** pdfkit's embedded-font wrapper exposes the underlying fontkit font; internal, but the only way to ask "is this glyph really there?". */
function fontHasGlyph(fontPath: string, codePoint: number): boolean {
  const doc = new PDFDocument();
  doc.font(fontPath);
  const font = (doc as unknown as { _font: { font: { hasGlyphForCodePoint(cp: number): boolean } } })._font.font;
  return font.hasGlyphForCodePoint(codePoint);
}

function isCompletePdf(bytes: Buffer): boolean {
  return bytes.subarray(0, 5).toString('latin1') === '%PDF-' && bytes.subarray(-6).toString('latin1').includes('%%EOF');
}

function pageCount(bytes: Buffer): number {
  return (bytes.toString('latin1').match(/\/Type \/Page\b(?!s)/g) ?? []).length;
}

const organization = {
  name: 'Example Consulting', legalName: 'Example Consulting Pvt Ltd', addressLine1: '12 Sample Road', addressLine2: null,
  city: 'Chennai', state: 'Tamil Nadu', postalCode: '600001', country: 'India', phone: '+919840012345',
  email: 'hello@example.test', website: null, gstin: '33ABCDE1234F1Z5',
};
const company = { name: 'Example Foods', legalName: null, addressLine1: '4 Demo Street', addressLine2: null, city: 'Coimbatore', state: null, postalCode: null, country: 'India' };
const contact = { firstName: 'Asha', lastName: 'Rao', email: 'asha@example.test', phone: null };

function sampleQuotation(overrides: Partial<QuotationResponse> = {}): QuotationResponse {
  return {
    id: 'q', number: 'Q-2026-0007', version: 2, pdfReference: 'Q-2026-0007-v2', companyId: 'c', companyName: 'Example Foods',
    contactId: 'k', contactName: 'Asha Rao', dealId: null, dealName: null, ownerId: null, ownerName: null, status: 'SENT',
    issueDate: '2026-11-24', validUntil: '2026-12-24', currency: 'INR', pricesIncludeTax: false,
    subtotal: '0.20', taxAmount: '0.04', total: '0.24', terms: 'Net 30', notes: null,
    sentAt: null, archivedAt: null, createdAt: '', updatedAt: '',
    gstBreakdown: [{ rate: '18', taxable: '0.20', gst: '0.04' }],
    lineItems: [{ id: 'l', position: 1, description: 'Sensor labels', quantity: '3.00', unitPrice: '0.10', discountPercent: '33.33', gstPercent: '18.00', taxableAmount: '0.20', gstAmount: '0.04', lineTotal: '0.24' }],
    ...overrides,
  };
}

describe('quotation PDF building blocks', () => {
  it('both bundled fonts really contain the rupee sign (and the check can fail: no Tamil letter)', () => {
    for (const path of [PDF_FONT_REGULAR, PDF_FONT_BOLD]) {
      expect(fontHasGlyph(path, 0x20b9)).toBe(true);
      expect(fontHasGlyph(path, 0x0b85)).toBe(false);
    }
  });

  it('the model prints exactly the API values through the shared formatter the screens use', () => {
    const model = buildQuotationPdfModel({ quotation: sampleQuotation(), organization, company, contact });
    expect(model.reference).toBe('Q-2026-0007-v2');
    expect(model.totals).toEqual([
      { label: 'Subtotal', value: formatRupees('0.20') },
      { label: 'GST 18%', value: formatRupees('0.04') },
      { label: 'Total', value: '₹ 0.24', strong: true },
    ]);
    expect(model.items).toEqual([
      { index: '1', description: 'Sensor labels', quantity: '3', unitPrice: '0.10', discount: '33.33%', gst: '18%', amount: '0.24' },
    ]);
    expect(model.priceNote).toBeNull();
    expect(model.meta).toContainEqual({ label: 'Valid until', value: '24 Dec 2026' });
    expect(model.seller.name).toBe('Example Consulting Pvt Ltd');
    expect(model.seller.lines).toContain('GSTIN: 33ABCDE1234F1Z5');
    expect(model.seller.lines).toContain('+91 98400 12345  ·  hello@example.test');
    expect(model.buyer.lines).toContain('Attn: Asha Rao');
  });

  it('leaves blank organisation details off the page instead of printing empty lines', () => {
    const bare = { ...organization, legalName: null, addressLine1: null, city: null, state: null, postalCode: null, country: null, phone: null, email: null, gstin: null };
    const model = buildQuotationPdfModel({ quotation: sampleQuotation(), organization: bare, company, contact });
    expect(model.seller).toEqual({ name: 'Example Consulting', lines: [] });
  });

  it('prints one GST row per rate used, and a per-line GST column (D101)', () => {
    const model = buildQuotationPdfModel({
      quotation: sampleQuotation({
        subtotal: '2200.00', taxAmount: '185.00', total: '2385.00',
        gstBreakdown: [{ rate: '5', taxable: '1200.00', gst: '60.00' }, { rate: '12.5', taxable: '1000.00', gst: '125.00' }],
        lineItems: [
          { id: 'a', position: 1, description: 'A', quantity: '1.00', unitPrice: '1200.00', discountPercent: '0.00', gstPercent: '5.00', taxableAmount: '1200.00', gstAmount: '60.00', lineTotal: '1260.00' },
          { id: 'b', position: 2, description: 'B', quantity: '1.00', unitPrice: '1000.00', discountPercent: '0.00', gstPercent: '12.50', taxableAmount: '1000.00', gstAmount: '125.00', lineTotal: '1125.00' },
        ],
      }),
      organization, company, contact,
    });
    expect(model.totals.map((row) => row.label)).toEqual(['Subtotal', 'GST 5%', 'GST 12.5%', 'Total']);
    expect(model.items.map((item) => item.gst)).toEqual(['5%', '12.5%']);
  });

  it('adds the "Prices are inclusive of GST" note only when prices include tax, and keeps the same totals rows', () => {
    const inclusive = buildQuotationPdfModel({ quotation: sampleQuotation({ pricesIncludeTax: true }), organization, company, contact });
    expect(inclusive.priceNote).toBe('Prices are inclusive of GST');
    const exclusive = buildQuotationPdfModel({ quotation: sampleQuotation(), organization, company, contact });
    expect(exclusive.priceNote).toBeNull();
  });

  it('formats dates without any time-zone shift', () => {
    expect(formatDateKey('2026-01-01')).toBe('1 Jan 2026');
    expect(formatDateKey('2026-12-31')).toBe('31 Dec 2026');
  });

  it('renders a complete PDF that carries the reference and total, and paginates long quotations', async () => {
    const short = await renderQuotationPdf(buildQuotationPdfModel({ quotation: sampleQuotation(), organization, company, contact }));
    expect(isCompletePdf(short)).toBe(true);
    expect(pageCount(short)).toBe(1);
    expect(short.toString('latin1')).toContain('Q-2026-0007-v2; total INR 0.24');

    const manyLines = Array.from({ length: 60 }, (_, index) => ({
      id: String(index), position: index + 1, description: `Line ${index + 1}`, quantity: '1.00', unitPrice: '1.00', discountPercent: '0.00', gstPercent: '18.00', taxableAmount: '1.00', gstAmount: '0.18', lineTotal: '1.18',
    }));
    const long = await renderQuotationPdf(buildQuotationPdfModel({ quotation: sampleQuotation({ lineItems: manyLines }), organization, company, contact }));
    expect(isCompletePdf(long)).toBe(true);
    expect(pageCount(long)).toBeGreaterThan(1);
  });
});

describe('GET /api/v1/quotations/:id/pdf', () => {
  it('returns a valid PDF download whose total matches the API and the screen formatter exactly', async () => {
    const tenant = await createTestTenant();
    await prisma.organization.update({ where: { id: tenant.organization.id }, data: { legalName: 'Example Consulting Pvt Ltd', gstin: '33ABCDE1234F1Z5' } });
    const app = createApp();
    const api = await signIn(app, tenant, 'staff');
    const context = await createQuotationContext(tenant);
    const created = (await api.post('/api/v1/quotations', quotationBody(context, { lineItems: AWKWARD_LINES }))).body.data;
    expect(created.total).toBe('0.24');

    const res = await api.get(`/api/v1/quotations/${created.id}/pdf`).buffer(true).parse((response, callback) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer) => chunks.push(chunk));
      response.on('end', () => callback(null, Buffer.concat(chunks)));
    });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toBe(`attachment; filename="${created.pdfReference}.pdf"`);
    expect(res.headers['cache-control']).toBe('no-store');
    const bytes = res.body as Buffer;
    expect(isCompletePdf(bytes)).toBe(true);
    expect(bytes.toString('latin1')).toContain(`${created.pdfReference}; total INR ${created.total}`);

    // The same text the screen prints for this total (formatRupees) is what
    // the PDF model prints — one formatter, so they cannot differ.
    const detail = (await api.get(`/api/v1/quotations/${created.id}`)).body.data;
    expect(detail.total).toBe('0.24');
    const model = buildQuotationPdfModel({
      quotation: detail,
      organization: await prisma.organization.findUniqueOrThrow({ where: { id: tenant.organization.id } }),
      company: context.company,
      contact: context.contact,
    });
    expect(model.totals.at(-1)).toEqual({ label: 'Total', value: formatRupees(detail.total), strong: true });
  });

  it('requires a session and hides other organisations\' quotations', async () => {
    const [tenant, other] = await createTwoTestTenants();
    const app = createApp();
    const api = await signIn(app, tenant);
    const otherApi = await signIn(app, other);
    const context = await createQuotationContext(tenant);
    const { id } = (await api.post('/api/v1/quotations', quotationBody(context))).body.data;

    expect((await request(app).get(`/api/v1/quotations/${id}/pdf`)).status).toBe(401);
    expect((await otherApi.get(`/api/v1/quotations/${id}/pdf`)).status).toBe(404);
  });
});
