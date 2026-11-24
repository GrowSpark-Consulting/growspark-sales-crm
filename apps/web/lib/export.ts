/**
 * Builds a CSV export URL carrying the exact same filters the caller already
 * passed to the matching list query, so "Download CSV" always reflects what
 * is on screen. Empty strings, undefined and false-for-a-flag values are
 * omitted rather than sent as literal "undefined"/"" query params.
 */
export function buildExportHref(
  path: string,
  params: Record<string, string | number | boolean | undefined>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    if (typeof value === "boolean" && !value) continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `${path}?${qs}` : path;
}
