// Thin Server Component wrapper (no client-side logic yet, so nothing to
// extract) — every page.tsx under (protected) carries its own `instant`
// export per the convention in D31 / PROJECT-STATE §12.
export const instant = false;

export default function ForbiddenPage() {
  return (
    <div>
      <p className="text-ink-muted">You don&apos;t have permission to view this page.</p>
    </div>
  );
}
