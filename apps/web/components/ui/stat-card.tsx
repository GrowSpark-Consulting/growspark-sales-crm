// Per docs/design-system/components/StatCard/README.md and bundle.css
// .gs-card/.gs-stat-label/.gs-stat-value: a KPI tile — label, a big tabular-
// figure number, and an optional one-line note. No delta is shown here: the
// dashboard API has no prior-period comparison to show one against.
export function StatCard({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-line bg-surface p-5 shadow-sm">
      <p className="text-[13px] leading-5 text-ink-muted">{label}</p>
      <p className="gs-num mt-1 text-[28px] leading-9 font-semibold tracking-tight">{value}</p>
      {note && <p className="mt-1 text-[13px] leading-5 text-ink-muted">{note}</p>}
    </div>
  );
}
