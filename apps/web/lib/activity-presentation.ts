import type { ActivityStatus, ActivityType } from "@growspark/shared";

const TYPE_LABELS: Record<ActivityType, string> = {
  TASK: "Task",
  CALL: "Call",
  MEETING: "Meeting",
  NOTE: "Note",
};

export function activityTypeLabel(type: ActivityType): string {
  return TYPE_LABELS[type];
}

const STATUS_LABELS: Record<ActivityStatus, string> = {
  OPEN: "Open",
  DONE: "Done",
  CANCELLED: "Cancelled",
};

const STATUS_BADGE_VARIANTS: Record<ActivityStatus, "default" | "success"> = {
  OPEN: "default",
  DONE: "success",
  CANCELLED: "default",
};

export function activityStatusLabel(status: ActivityStatus): string {
  return STATUS_LABELS[status];
}

export function activityStatusBadgeVariant(status: ActivityStatus): "default" | "success" {
  return STATUS_BADGE_VARIANTS[status];
}
