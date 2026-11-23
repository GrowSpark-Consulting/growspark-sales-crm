import type { ActivityResponse, ActivityStatus, ActivityType } from "@growspark/shared";

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

/** The record an activity is linked to, as a detail-page href — null when the API hasn't resolved one. */
export function activityRecordHref(
  activity: Pick<ActivityResponse, "leadId" | "contactId" | "companyId" | "dealId">,
): string | null {
  if (activity.leadId) return `/leads/${activity.leadId}`;
  if (activity.contactId) return `/contacts/${activity.contactId}`;
  if (activity.companyId) return `/companies/${activity.companyId}`;
  if (activity.dealId) return `/deals/${activity.dealId}`;
  return null;
}
