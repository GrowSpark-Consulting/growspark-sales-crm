import { formatRupees, type QuotationGstBreakdownRow } from "@growspark/shared";
import { formatPercent } from "@/lib/quotation-presentation";

export interface QuotationTotalsView {
  subtotal: string;
  gstBreakdown: readonly Pick<QuotationGstBreakdownRow, "rate" | "gst">[];
  total: string;
}

/**
 * The totals block, shared by the quotation form (live preview) and the
 * detail page: Subtotal, one GST row per rate used, Total (D101). Every value
 * is a decimal string produced by the shared money rule and printed through
 * the same formatRupees() the PDF uses — so screen and PDF always show
 * identical text, row for row (D85).
 */
export function QuotationTotalsSummary({
  totals,
  pricesIncludeTax = false,
  pending = false,
}: {
  totals: QuotationTotalsView | undefined;
  pricesIncludeTax?: boolean;
  pending?: boolean;
}) {
  const show = (value: string | undefined) => (value === undefined ? "…" : formatRupees(value));

  return (
    <dl className="ml-auto w-full max-w-sm space-y-2 text-sm" aria-busy={pending} data-testid="quotation-totals">
      <div className="flex justify-between">
        <dt className="text-ink-muted">Subtotal</dt>
        <dd className="gs-num">{show(totals?.subtotal)}</dd>
      </div>
      {totals === undefined ? (
        <div className="flex justify-between">
          <dt className="text-ink-muted">GST</dt>
          <dd className="gs-num">…</dd>
        </div>
      ) : (
        totals.gstBreakdown.map((row) => (
          <div key={row.rate} className="flex justify-between" data-testid="quotation-gst-row">
            <dt className="text-ink-muted">GST {formatPercent(row.rate)}%</dt>
            <dd className="gs-num">{show(row.gst)}</dd>
          </div>
        ))
      )}
      <div className="flex justify-between border-t border-line-strong pt-2 text-base">
        <dt className="body-strong">Total</dt>
        <dd className="gs-num body-strong" data-testid="quotation-total">
          {show(totals?.total)}
        </dd>
      </div>
      {pricesIncludeTax && <p className="small text-right text-ink-muted">Prices are inclusive of GST</p>}
    </dl>
  );
}
