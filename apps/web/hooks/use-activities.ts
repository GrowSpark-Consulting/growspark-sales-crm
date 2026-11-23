import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type { ActivityResponse, TimelineEntry, TodayQuery, TodayResponse } from "@growspark/shared";
import { apiGet } from "@/lib/api-client";

export interface ActivitiesListParams {
  page?: number; pageSize?: number; sort?: string; status?: string; type?: string; priority?: string;
  overdue?: boolean; dueFrom?: string; dueTo?: string;
}
export interface ActivitiesListResult { data: ActivityResponse[]; meta: { page: number; pageSize: number; total: number } }
export function useActivitiesList(params: ActivitiesListParams) {
  const query = new URLSearchParams({ page: String(params.page ?? 1), pageSize: String(params.pageSize ?? 25), sort: params.sort ?? "dueAt:asc" });
  for (const key of ["status", "type", "priority", "dueFrom", "dueTo"] as const) if (params[key]) query.set(key, params[key]!);
  if (params.overdue) query.set("overdue", "true");
  return useQuery({ queryKey: [ACTIVITIES_QUERY_KEY_ROOT, params], queryFn: () => apiGet<ActivitiesListResult>(`/api/v1/activities?${query}`), placeholderData: (previous) => previous });
}

export function useToday(scope: TodayQuery["scope"]) {
  return useQuery({ queryKey: ["today", scope], queryFn: () => apiGet<TodayResponse>(`/api/v1/today?scope=${scope}`) });
}

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
