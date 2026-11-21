import { useInfiniteQuery } from "@tanstack/react-query";
import type { TimelineEntry } from "@growspark/shared";
import { apiGet } from "@/lib/api-client";

export type TimelineOwner = "leads" | "contacts" | "companies" | "deals";
export interface TimelinePage {
  data: TimelineEntry[];
  meta: { page: number; pageSize: number; total: number };
}

export const ACTIVITIES_QUERY_KEY_ROOT = "activities" as const;
export const TIMELINE_QUERY_KEY_ROOT = "record-timeline" as const;

export function useRecordTimeline(owner: TimelineOwner, recordId: string) {
  return useInfiniteQuery({
    queryKey: [TIMELINE_QUERY_KEY_ROOT, owner, recordId],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => apiGet<TimelinePage>(`/api/v1/${owner}/${recordId}/timeline?page=${pageParam}&pageSize=10`),
    getNextPageParam: (lastPage) => lastPage.meta.page * lastPage.meta.pageSize < lastPage.meta.total
      ? lastPage.meta.page + 1
      : undefined,
  });
}
