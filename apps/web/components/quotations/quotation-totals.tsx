import { formatRupees, type QuotationTotals } from "@growspark/shared";
import { formatPercent } from "@/lib/quotation-presentation";

/**
 * The totals block, shared by the quotation form (live preview) and the
 * detail page. Every value is the server's own string, printed through the
 * same formatRupees() the PDF uses — so screen and PDF always show
 * identical text, row for row (D85).
 */
export function QuotationTotalsSummary({
  totals,
  discountPercent,
  taxPercent,
  pending = false,
}: {
  totals: Omit<QuotationTotals, "lineTotals"> | undefined;
  discountPercent: string;
  taxPercent: string;
  pending?: boolean;
}) {
  const show = (value: string | undefined) => (value === undefined ? "…" : formatRupees(value));
  const hasDiscount = totals !== undefined && totals.discountAmount !== "0.00";

  return (
    <dl className="ml-auto w-full max-w-sm space-y-2 text-sm" aria-busy={pending} data-testid="quotation-totals">
      <div className="flex justify-between">
        <dt className="text-ink-muted">Subtotal</dt>
        <dd className="gs-num">{show(totals?.subtotal)}</dd>
      </div>
      {hasDiscount && (
        <>
          <div className="flex justify-between">
            <dt className="text-ink-muted">Discount ({formatPercent(discountPercent)}%)</dt>
            <dd className="gs-num">− {show(totals?.discountAmount)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-muted">Taxable amount</dt>
            <dd className="gs-num">{show(totals?.taxableAmount)}</dd>
          </div>
        </>
      )}
      <div className="flex justify-between">
        <dt className="text-ink-muted">GST ({formatPercent(taxPercent)}%)</dt>
        <dd className="gs-num">{show(totals?.taxAmount)}</dd>
      </div>
      <div className="flex justify-between border-t border-line-strong pt-2 text-base">
        <dt className="body-strong">Total</dt>
        <dd className="gs-num body-strong" data-testid="quotation-total">
          {show(totals?.total)}
        </dd>
      </div>
    </dl>
  );
}
