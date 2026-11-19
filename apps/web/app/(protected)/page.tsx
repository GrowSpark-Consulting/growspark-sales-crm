// Thin Server Component wrapper (no client-side logic yet, so nothing to
// extract) — every page.tsx under (protected) carries its own `instant`
// export per the convention in D31 / PROJECT-STATE §12.
export const instant = false;

export default function HomePage() {
  return (
    <div>
      <p className="text-ink-muted">The dashboard will appear here in a later package.</p>
    </div>
  );
}
