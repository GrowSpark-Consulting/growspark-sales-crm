/**
 * `<input type="datetime-local">` reads/writes a local, timezone-less
 * string ("2026-11-25T14:30"); the API's `nextFollowUpAt` is a strict,
 * `Z`-suffixed UTC ISO string (`z.iso.datetime()`, D35). These convert at
 * that boundary — nowhere else in the app needs to know about this format.
 */
export function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromDatetimeLocalValue(value: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}
