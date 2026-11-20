import type { DealStatus } from "@growspark/shared";

// Same tone logic as lead-presentation.ts (Badge README: status always dot +
// word): Open is a neutral in-progress state, Won is positive, Lost is
// negative.
const STATUS_LABELS: Record<DealStatus, string> = {
  OPEN: "Open",
  WON: "Won",
  LOST: "Lost",
};

const STATUS_BADGE_VARIANTS: Record<DealStatus, "info" | "success" | "danger"> = {
  OPEN: "info",
  WON: "success",
  LOST: "danger",
};

export function dealStatusLabel(status: DealStatus): string {
  return STATUS_LABELS[status];
}

export function dealStatusBadgeVariant(status: DealStatus): "info" | "success" | "danger" {
  return STATUS_BADGE_VARIANTS[status];
}
