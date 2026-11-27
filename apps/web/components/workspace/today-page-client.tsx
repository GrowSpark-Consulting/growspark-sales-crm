"use client";

import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import type { TodayResponse } from "@growspark/shared";
import { Button } from "@/components/ui/button";
import { StatusButtonGroup } from "@/components/ui/status-button-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AddFollowUpDialog } from "@/components/activities/add-follow-up-dialog";
import { useToday, ACTIVITIES_QUERY_KEY_ROOT } from "@/hooks/use-activities";
import { useListUrlState } from "@/hooks/use-list-url-state";
import { apiPost } from "@/lib/api-client";
import { formatDate, formatTime } from "@/lib/format";

type TodaySectionKey = keyof TodayResponse["data"];
type TodayItem = TodayResponse["data"][TodaySectionKey]["items"][number];

const COMPLETE_OPTIONS = [{ value: "complete", label: "Complete", statusLabel: "Completed", variant: "default" }] as const;

const SECTIONS: { key: TodaySectionKey; title: string; emptyText: string; canComplete: boolean }[] = [
  { key: "overdueTasks", title: "Overdue", emptyText: "Nothing overdue.", canComplete: true },
  { key: "tasksDueToday", title: "Tasks due today", emptyText: "No tasks due today.", canComplete: true },
  { key: "meetings", title: "Meetings this week", emptyText: "No meetings scheduled this week.", canComplete: false },
  { key: "newLeads", title: "New leads", emptyText: "No new leads right now.", canComplete: false },
  { key: "closingDeals", title: "Deals closing soon", emptyText: "No deals closing in the next 14 days.", canComplete: false },
  { key: "dealsWithoutActivity", title: "Deals with no next activity", emptyText: "Every open deal has a next activity.", canComplete: false },
  { key: "recentlyUpdatedDeals", title: "Recently updated deals", emptyText: "No deals updated in the last 3 days.", canComplete: false },
];

export function TodayPageClient() {
  const { searchParams, setParams } = useListUrlState();
  const queryClient = useQueryClient();
  const scope = searchParams.get("scope") === "all" ? "all" : "mine";
  const today = useToday(scope);

  // The status group shows the success toast and, if this throws, the error toast.
  async function completeTask(item: TodayItem) {
    await apiPost(`/api/v1/activities/${item.id}/complete`);
    await queryClient.invalidateQueries({ queryKey: ["today"] });
    await queryClient.invalidateQueries({ queryKey: [ACTIVITIES_QUERY_KEY_ROOT] });
  }

  return (
    <div className="space-y-5">
      <div className="inline-flex rounded-md border border-line-strong p-0.5" role="group" aria-label="Today scope">
        <Button
          type="button"
          variant={scope === "mine" ? "default" : "ghost"}
          size="sm"
          aria-pressed={scope === "mine"}
          onClick={() => setParams({ scope: undefined })}
        >
          Mine
        </Button>
        <Button
          type="button"
          variant={scope === "all" ? "default" : "ghost"}
          size="sm"
          aria-pressed={scope === "all"}
          onClick={() => setParams({ scope: "all" })}
        >
          All
        </Button>
      </div>

      {today.isLoading && (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-48 w-full" />
          ))}
        </div>
      )}

      {today.isError && (
        <div>
          <Alert variant="destructive">
            <AlertDescription>Could not load the Today workspace.</AlertDescription>
          </Alert>
          <Button className="mt-3" size="sm" variant="outline" onClick={() => void today.refetch()}>
            Try again
          </Button>
        </div>
      )}

      {!today.isLoading && !today.isError && today.data && (
        <TodaySections data={today.data.data} onComplete={completeTask} />
      )}
    </div>
  );
}

function TodaySections({ data, onComplete }: { data: TodayResponse["data"]; onComplete: (item: TodayItem) => Promise<unknown> }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {SECTIONS.map((section) => {
        const sectionData = data[section.key];
        return (
          <section key={section.key} className="rounded-lg border border-line bg-surface p-4" aria-label={section.title}>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="h3">{section.title}</h2>
              <span className="label text-ink-muted">{sectionData.total}</span>
            </div>
            {sectionData.items.length === 0 ? (
              <p className="body text-ink-muted">{section.emptyText}</p>
            ) : (
              <ul className="divide-y divide-line">
                {sectionData.items.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <Link href={item.href} className="body-strong text-ink hover:underline">
                        {item.title}
                      </Link>
                      {item.dueAt && (
                        <p className="small text-ink-muted">
                          {formatDate(item.dueAt)} · {formatTime(item.dueAt)}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {section.canComplete && (
                        <StatusButtonGroup
                          groupLabel={`Change status of ${item.title}`}
                          options={COMPLETE_OPTIONS}
                          onSelect={() => onComplete(item)}
                          errorMessage="Could not complete this task. Please try again."
                        />
                      )}
                      {item.recordType && item.recordId && (
                        <AddFollowUpDialog owner={item.recordType} recordId={item.recordId} recordLabel={item.title} />
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
