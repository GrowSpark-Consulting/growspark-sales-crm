// Shared formatters for the Grow Spark design system — see
// docs/design-system/README.md ("Numbers: Indian digit grouping... 4,82,000.
// Use a compact form (48.2 L, 1.2 Cr) for big KPI numbers.").

import { matchCountryCallingCode } from "@growspark/shared";

/**
 * D41: displays a stored canonical E.164 phone number ("+919840012345") in a
 * readable, grouped form ("+91 98400 12345"), never the raw E.164 string.
 * An unrecognised prefix (legacy pre-D41 data, or a format this app's fixed
 * country-code list doesn't cover) is shown as-is rather than mangled.
 */
export function formatPhoneForDisplay(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = matchCountryCallingCode(value);
  if (!match) return value;
  const national = value.slice(match.code.length);
  if (match.code === "+91" && national.length === 10) {
    return `${match.code} ${national.slice(0, 5)} ${national.slice(5)}`;
  }
  return `${match.code} ${national}`;
}

const RUPEE = "₹";
const LAKH = 100_000;
const CRORE = 10_000_000;

const inrGrouping = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** Full Indian-grouped rupee amount, e.g. formatINR(482000) -> "₹ 4,82,000" */
export function formatINR(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  return `${sign}${RUPEE} ${inrGrouping.format(Math.abs(amount))}`;
}

/**
 * Compact rupee amount for KPIs, e.g. formatINRCompact(4820000) -> "₹ 48.2 L",
 * formatINRCompact(12000000) -> "₹ 1.2 Cr". Below one lakh, falls back to
 * the full grouped form (there is nothing to compact).
 */
export function formatINRCompact(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount);
  if (abs >= CRORE) {
    return `${sign}${RUPEE} ${(abs / CRORE).toFixed(1)} Cr`;
  }
  if (abs >= LAKH) {
    return `${sign}${RUPEE} ${(abs / LAKH).toFixed(1)} L`;
  }
  return formatINR(amount);
}

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** e.g. formatDate("2026-11-19") -> "19 Nov 2026" */
export function formatDate(date: Date | string): string {
  return dateFormatter.format(typeof date === "string" ? new Date(date) : date);
}

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

/** e.g. formatTime("2026-11-19T14:30:00") -> "2:30 PM" */
export function formatTime(date: Date | string): string {
  return timeFormatter.format(typeof date === "string" ? new Date(date) : date);
}
