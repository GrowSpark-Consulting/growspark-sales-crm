import type { LeadStatus, Priority } from "@growspark/shared";

// Badge README mapping (docs/design-system/components/Badge/README.md):
// "New lead" -> accent; Won/positive -> success; Lost/negative -> danger;
// in-progress -> info; neutral -> default. Applied to lead status/priority,
// which the README doesn't name directly but the same tone logic fits.
const STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  UNQUALIFIED: "Unqualified",
  CONVERTED: "Converted",
};

const STATUS_BADGE_VARIANTS: Record<LeadStatus, "accent" | "info" | "success" | "danger" | "default"> = {
  NEW: "accent",
  CONTACTED: "info",
  QUALIFIED: "success",
  UNQUALIFIED: "danger",
  CONVERTED: "success",
};

export function leadStatusLabel(status: LeadStatus): string {
  return STATUS_LABELS[status];
}

export function leadStatusBadgeVariant(status: LeadStatus): "accent" | "info" | "success" | "danger" | "default" {
  return STATUS_BADGE_VARIANTS[status];
}

const BADGE_VARIANT_CHART_COLORS: Record<"accent" | "info" | "success" | "danger" | "default", string> = {
  accent: "var(--accent)",
  info: "var(--info)",
  success: "var(--success)",
  danger: "var(--danger)",
  default: "var(--ink-muted)",
};

/** The same status tone as the badge, as a chart-fill colour — for the leads-by-status dashboard chart. */
export function leadStatusChartColor(status: LeadStatus): string {
  return BADGE_VARIANT_CHART_COLORS[leadStatusBadgeVariant(status)];
}

const PRIORITY_LABELS: Record<Priority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
};

const PRIORITY_BADGE_VARIANTS: Record<Priority, "default" | "warning" | "danger"> = {
  LOW: "default",
  MEDIUM: "warning",
  HIGH: "danger",
};

export function priorityLabel(priority: Priority): string {
  return PRIORITY_LABELS[priority];
}

export function priorityBadgeVariant(priority: Priority): "default" | "warning" | "danger" {
  return PRIORITY_BADGE_VARIANTS[priority];
}
