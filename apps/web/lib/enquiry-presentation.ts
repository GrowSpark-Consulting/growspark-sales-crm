import type { SubmissionStatus } from "@growspark/shared";

// Same tone logic as lead-presentation.ts's STATUS_BADGE_VARIANTS: new/raw ->
// accent, a successful outcome -> success, a failed one -> danger, spam -> warning.
const STATUS_LABELS: Record<SubmissionStatus, string> = {
  RECEIVED: "Received",
  LEAD_CREATED: "Lead created",
  REJECTED: "Rejected",
  SPAM: "Spam",
};

const STATUS_BADGE_VARIANTS: Record<SubmissionStatus, "accent" | "success" | "danger" | "warning"> = {
  RECEIVED: "accent",
  LEAD_CREATED: "success",
  REJECTED: "danger",
  SPAM: "warning",
};

export function enquiryStatusLabel(status: SubmissionStatus): string {
  return STATUS_LABELS[status];
}

export function enquiryStatusBadgeVariant(status: SubmissionStatus): "accent" | "success" | "danger" | "warning" {
  return STATUS_BADGE_VARIANTS[status];
}
