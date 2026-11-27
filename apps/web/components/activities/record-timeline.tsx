"use client";

import { useQueryClient } from "@tanstack/react-query";
import type { TimelineEntry } from "@growspark/shared";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusButtonGroup } from "@/components/ui/status-button-group";
import { Skeleton } from "@/components/ui/skeleton";
import { apiPost } from "@/lib/api-client";
import { formatDate, formatTime } from "@/lib/format";
import { TIMELINE_QUERY_KEY_ROOT, useRecordTimeline, type TimelineOwner } from "@/hooks/use-activities";
import { ActivityComposer } from "@/components/activities/activity-composer";

const TIMELINE_STATUS_OPTIONS = [
  { value: "complete", label: "Complete", statusLabel: "Completed", variant: "outline" },
  { value: "cancel", label: "Cancel", statusLabel: "Cancelled", variant: "ghost" },
] as const;

function TimelineActivity({ entry, onAction }: { entry: TimelineEntry; onAction: (id: string, action: "complete" | "cancel") => Promise<void> }) {
  return (
    <li className="space-y-2 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="body-strong">{entry.title}</p>
          <p className="small text-ink-muted">{formatDate(entry.at)} · {formatTime(entry.at)}</p>
        </div>
        {entry.status === "OPEN" && (
          <StatusButtonGroup
            groupLabel={`Change status of ${entry.title}`}
            options={TIMELINE_STATUS_OPTIONS}
            onSelect={(action) => onAction(entry.id, action)}
            errorMessage="Could not update this activity. Please try again."
          />
        )}
      </div>
      {entry.description && <p className="body whitespace-pre-wrap">{entry.description}</p>}
      {entry.status === "DONE" && entry.completedAt && <p className="small text-success">
        Completed by {entry.completedByName ?? "a team member"} · {formatDate(entry.completedAt)} · {formatTime(entry.completedAt)}
      </p>}
      {entry.status === "CANCELLED" && <Badge>Cancelled</Badge>}
    </li>
  );
}

export function RecordTimeline({ owner, recordId }: { owner: TimelineOwner; recordId: string }) {
  const queryClient = useQueryClient();
  const timeline = useRecordTimeline(owner, recordId);
  // The status group shows the success toast and, if this throws, the error toast.
  async function act(id: string, action: "complete" | "cancel") {
    await apiPost(`/api/v1/activities/${id}/${action}`);
    await queryClient.invalidateQueries({ queryKey: [TIMELINE_QUERY_KEY_ROOT, owner, recordId] });
    await queryClient.invalidateQueries({ queryKey: ["activities"] });
    if (owner === "leads") await queryClient.invalidateQueries({ queryKey: ["leads"] });
    if (owner === "deals") await queryClient.invalidateQueries({ queryKey: ["deals"] });
  }
  const pages = timeline.data?.pages ?? [];
  const entries = pages.flatMap((page) => page.data);

  return (
    <div className="space-y-6">
      <ActivityComposer owner={owner} recordId={recordId} />
      <section aria-label="Timeline" className="rounded-lg border border-line bg-surface">
        {timeline.isLoading && <div className="space-y-3 p-4"><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /></div>}
        {timeline.isError && <div className="p-4"><Alert variant="destructive"><AlertDescription>Could not load this timeline.</AlertDescription></Alert><Button className="mt-3" size="sm" variant="outline" onClick={() => void timeline.refetch()}>Retry</Button></div>}
        {!timeline.isLoading && !timeline.isError && entries.length === 0 && <p className="p-4 text-ink-muted">No activity or history yet. Add an activity above to start the timeline.</p>}
        {entries.length > 0 && <ul className="divide-y divide-line">{entries.map((entry) => entry.kind === "ACTIVITY"
          ? <TimelineActivity key={`${entry.kind}-${entry.id}`} entry={entry} onAction={act} />
          : <li key={`${entry.kind}-${entry.id}`} className="p-4"><p className="body-strong">{entry.title}</p><p className="small text-ink-muted">{formatDate(entry.at)} · {formatTime(entry.at)}</p>{entry.description && <p className="small text-ink-muted">{entry.description}</p>}</li>)}</ul>}
        {timeline.hasNextPage && <div className="border-t border-line p-3 text-center"><Button variant="outline" onClick={() => void timeline.fetchNextPage()} disabled={timeline.isFetchingNextPage}>{timeline.isFetchingNextPage ? "Loading…" : "Load more"}</Button></div>}
      </section>
    </div>
  );
}

export function NextActivityField({ activity }: { activity: { type: string; subject: string; dueAt: string | null; isOverdue: boolean } | null | undefined }) {
  return (
    <span className="block">
      {activity ? <span className="body-strong">
        <span className="block">{activity.type[0]}{activity.type.slice(1).toLowerCase()}: {activity.subject}</span>
        {activity.dueAt && <span className="small block text-ink-muted">{formatDate(activity.dueAt)} · {formatTime(activity.dueAt)}</span>}
        {activity.isOverdue && <Badge variant="danger" className="mt-1">Overdue</Badge>}
      </span> : <span className="body text-ink-muted">—</span>}
    </span>
  );
}
