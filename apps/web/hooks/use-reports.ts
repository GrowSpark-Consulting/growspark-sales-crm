import { useQuery } from "@tanstack/react-query";
import type { ReportKey, ReportsResponse } from "@growspark/shared";
import { apiGet } from "@/lib/api-client";
import { buildExportHref } from "@/lib/export";

export const REPORTS_QUERY_KEY_ROOT = "reports" as const;

export interface ReportsParams {
  from?: string;
  to?: string;
  scope: "all" | "mine";
}

export function useReports(params: ReportsParams) {
  return useQuery({
    queryKey: [REPORTS_QUERY_KEY_ROOT, params],
    queryFn: () => apiGet<ReportsResponse>(buildExportHref("/api/v1/reports", { scope: params.scope, from: params.from, to: params.to })),
  });
}

/** The CSV for one report, with exactly the filters the page is showing. */
export function reportExportHref(report: ReportKey, params: ReportsParams): string {
  return buildExportHref(`/api/v1/reports/${report}/export`, { scope: params.scope, from: params.from, to: params.to });
}
