import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { NotificationResponse, NotificationsListResponse } from "@growspark/shared";
import { apiGet, apiPost } from "@/lib/api-client";

export const NOTIFICATIONS_QUERY_KEY_ROOT = "notifications" as const;

/**
 * The bell asks for the unread count once a minute (D90). Polling pauses
 * while the tab is hidden: TanStack Query only fires an interval tick when
 * the document is visible unless refetchIntervalInBackground is true, and it
 * refetches straight away when the tab becomes visible again
 * (refetchOnWindowFocus, on by default).
 */
export const NOTIFICATION_POLL_INTERVAL_MS = 60_000;

export interface NotificationsListParams {
  page?: number;
  pageSize?: number;
  unreadOnly?: boolean;
}

function buildQuery(params: NotificationsListParams): string {
  const searchParams = new URLSearchParams();
  searchParams.set("page", String(params.page ?? 1));
  searchParams.set("pageSize", String(params.pageSize ?? 25));
  if (params.unreadOnly) searchParams.set("unreadOnly", "true");
  return searchParams.toString();
}

export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: [NOTIFICATIONS_QUERY_KEY_ROOT, "unread-count"],
    queryFn: () => apiGet<{ data: { unread: number } }>("/api/v1/notifications/unread-count"),
    refetchInterval: NOTIFICATION_POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
  });
}

export function useNotificationsList(params: NotificationsListParams) {
  return useQuery({
    queryKey: [NOTIFICATIONS_QUERY_KEY_ROOT, "list", params],
    queryFn: () => apiGet<NotificationsListResponse>(`/api/v1/notifications?${buildQuery(params)}`),
    placeholderData: (previous) => previous,
  });
}

/** Both mutations refresh the list and the bell's count together. */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPost<{ data: NotificationResponse }>(`/api/v1/notifications/${id}/read`),
    onSettled: () => queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_QUERY_KEY_ROOT] }),
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost<{ data: { updated: number } }>("/api/v1/notifications/read-all"),
    onSettled: () => queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_QUERY_KEY_ROOT] }),
  });
}
