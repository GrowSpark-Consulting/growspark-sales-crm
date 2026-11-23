import { useQuery } from "@tanstack/react-query";
import type { DashboardResponse } from "@growspark/shared";
import { apiGet } from "@/lib/api-client";

export const DASHBOARD_QUERY_KEY_ROOT = "dashboard" as const;

export interface DashboardParams {
  from?: string;
  to?: string;
  scope: "all" | "mine";
}

export function useDashboard(params: DashboardParams) {
  const query = new URLSearchParams({ scope: params.scope });
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);
  return useQuery({
    queryKey: [DASHBOARD_QUERY_KEY_ROOT, params],
    queryFn: () => apiGet<DashboardResponse>(`/api/v1/dashboard?${query}`),
  });
}
