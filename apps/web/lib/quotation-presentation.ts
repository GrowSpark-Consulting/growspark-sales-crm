import type { QuotationStatus } from "@growspark/shared";

// Same tone logic as deal-presentation.ts (Badge README: dot + word, colour
// never alone): Draft is neutral, Sent is in progress, Accepted positive,
// Rejected negative, Expired a warning (it lapsed, nobody decided).
const STATUS_LABELS: Record<QuotationStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  EXPIRED: "Expired",
};

type BadgeVariant = "default" | "info" | "success" | "danger" | "warning";

const STATUS_BADGE_VARIANTS: Record<QuotationStatus, BadgeVariant> = {
  DRAFT: "default",
  SENT: "info",
  ACCEPTED: "success",
  REJECTED: "danger",
  EXPIRED: "warning",
};

export function quotationStatusLabel(status: QuotationStatus): string {
  return STATUS_LABELS[status];
}

export function quotationStatusBadgeVariant(status: QuotationStatus): BadgeVariant {
  return STATUS_BADGE_VARIANTS[status];
}

/** "18.00" -> "18", "33.33" -> "33.33" — matches how the PDF prints percentages. */
export function formatPercent(value: string): string {
  return value.includes(".") ? value.replace(/0+$/, "").replace(/\.$/, "") : value;
}
