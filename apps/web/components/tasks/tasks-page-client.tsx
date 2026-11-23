"use client";

import Link from "next/link";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { activityTypeSchema, PRIORITIES, type ActivityResponse, type Priority } from "@growspark/shared";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useActivitiesList, ACTIVITIES_QUERY_KEY_ROOT } from "@/hooks/use-activities";
import { useListUrlState } from "@/hooks/use-list-url-state";
import { apiPost, ApiError } from "@/lib/api-client";
import { formatDate, formatTime } from "@/lib/format";
import {
  activityRecordHref,
  activityTypeLabel,
  activityStatusBadgeVariant,
  activityStatusLabel,
} from "@/lib/activity-presentation";
import { priorityBadgeVariant, priorityLabel } from "@/lib/lead-presentation";

const ANY = "ANY";
const FOLLOW_UP_TYPES = activityTypeSchema.options.filter((type) => type !== "NOTE");
type Tab = "OPEN" | "OVERDUE" | "DONE";

/** A date-only `<input>` value, turned into the UTC instant of that local day's start or end-of-day. */
function dayBound(day: string, end: boolean): string | undefined {
  if (!day) return undefined;
  return new Date(`${day}T${end ? "23:59:59.999" : "00:00:00.000"}`).toISOString();
}

export function TasksPageClient() {
  const { searchParams, page, pageSize, setParams } = useListUrlState();
  const queryClient = useQueryClient();

  const tab: Tab = searchParams.get("overdue") === "true" ? "OVERDUE" : searchParams.get("status") === "DONE" ? "DONE" : "OPEN";
  const type = searchParams.get("type") ?? undefined;
  const priority = searchParams.get("priority") ?? undefined;
  const dueFromDay = searchParams.get("dueFrom") ?? "";
  const dueToDay = searchParams.get("dueTo") ?? "";

  const listQuery = useActivitiesList({
    page,
    pageSize,
    status: tab === "DONE" ? "DONE" : "OPEN",
    overdue: tab === "OVERDUE" || undefined,
    type,
    priority,
    dueFrom: dayBound(dueFromDay, false),
    dueTo: dayBound(dueToDay, true),
    sort: "dueAt:asc",
  });

  function selectTab(nextTab: Tab) {
    setParams({
      status: nextTab === "DONE" ? "DONE" : "OPEN",
      overdue: nextTab === "OVERDUE" ? "true" : undefined,
    });
  }

  async function changeStatus(activity: ActivityResponse, action: "complete" | "cancel") {
    try {
      await apiPost(`/api/v1/activities/${activity.id}/${action}`);
      await queryClient.invalidateQueries({ queryKey: [ACTIVITIES_QUERY_KEY_ROOT] });
      await queryClient.invalidateQueries({ queryKey: ["today"] });
      toast.success(action === "complete" ? `"${activity.subject}" was completed.` : `"${activity.subject}" was cancelled.`);
    } catch (cause) {
      toast.error(cause instanceof ApiError ? cause.message : "Could not update this activity. Please try again.");
    }
  }

  const columns: DataTableColumn<ActivityResponse>[] = [
    {
      key: "subject",
      header: "Subject",
      render: (activity) => {
        const href = activityRecordHref(activity);
        return href ? (
          <Link href={href} className="body-strong text-ink hover:underline">
            {activity.subject}
          </Link>
        ) : (
          <span className="body-strong">{activity.subject}</span>
        );
      },
    },
    {
      key: "type",
      header: "Type",
      render: (activity) => <span className="text-ink-muted">{activityTypeLabel(activity.type)}</span>,
    },
    {
      key: "priority",
      header: "Priority",
      render: (activity) => <Badge variant={priorityBadgeVariant(activity.priority)}>{priorityLabel(activity.priority)}</Badge>,
    },
    {
      key: "dueAt",
      header: "Due",
      render: (activity) => (
        <span className="gs-num text-ink-muted">
          {activity.dueAt ? `${formatDate(activity.dueAt)} · ${formatTime(activity.dueAt)}` : "No due date"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Status",
      align: "right",
      render: (activity) =>
        activity.status === "OPEN" ? (
          <div className="flex justify-end gap-2">
            <Button size="sm" onClick={() => void changeStatus(activity, "complete")}>
              Complete
            </Button>
            <Button size="sm" variant="outline" onClick={() => void changeStatus(activity, "cancel")}>
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex justify-end">
            <Badge variant={activityStatusBadgeVariant(activity.status)}>{activityStatusLabel(activity.status)}</Badge>
          </div>
        ),
    },
  ];

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={(value) => selectTab(value as Tab)}>
        <TabsList>
          <TabsTrigger value="OPEN">Open</TabsTrigger>
          <TabsTrigger value="OVERDUE">Overdue</TabsTrigger>
          <TabsTrigger value="DONE">Done</TabsTrigger>
        </TabsList>
      </Tabs>

      <DataTable
        columns={columns}
        rows={listQuery.data?.data ?? []}
        rowKey={(activity) => activity.id}
        isLoading={listQuery.isLoading}
        isError={listQuery.isError}
        onRetry={() => listQuery.refetch()}
        page={page}
        pageSize={pageSize}
        total={listQuery.data?.meta.total ?? 0}
        onPageChange={(nextPage) => setParams({ page: nextPage })}
        emptyTitle={tab === "DONE" ? "Nothing completed yet" : tab === "OVERDUE" ? "Nothing overdue" : "You're all caught up"}
        emptyDescription={
          tab === "DONE"
            ? "Activities you complete or cancel will appear here."
            : tab === "OVERDUE"
              ? "Overdue tasks, calls and meetings will show up here."
              : "Open tasks, calls and meetings assigned to anyone in the organisation will show up here."
        }
        filterBar={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={type ?? ANY} onValueChange={(value) => setParams({ type: value === ANY ? undefined : value })}>
              <SelectTrigger className="w-36" aria-label="Filter by type">
                <SelectValue placeholder="Any type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any type</SelectItem>
                {FOLLOW_UP_TYPES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {activityTypeLabel(value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={priority ?? ANY}
              onValueChange={(value) => setParams({ priority: value === ANY ? undefined : value })}
            >
              <SelectTrigger className="w-32" aria-label="Filter by priority">
                <SelectValue placeholder="Any priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any priority</SelectItem>
                {PRIORITIES.map((value: Priority) => (
                  <SelectItem key={value} value={value}>
                    {priorityLabel(value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1">
              <Input
                type="date"
                aria-label="Due from"
                value={dueFromDay}
                onChange={(event) => setParams({ dueFrom: event.target.value || undefined })}
                className="w-36"
              />
              <span className="text-ink-muted">–</span>
              <Input
                type="date"
                aria-label="Due to"
                value={dueToDay}
                onChange={(event) => setParams({ dueTo: event.target.value || undefined })}
                className="w-36"
              />
            </div>
          </div>
        }
      />
    </div>
  );
}
