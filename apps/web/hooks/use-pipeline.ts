import { useQuery } from "@tanstack/react-query";
import type { PipelineStageResponse, PipelineSummaryResponse } from "@growspark/shared";
import { apiGet } from "@/lib/api-client";

export const PIPELINE_QUERY_KEY_ROOT = "pipeline" as const;

/** GET /pipeline/stages — the org's one pipeline, ordered by position (3.2). */
export function usePipelineStages() {
  return useQuery({
    queryKey: [PIPELINE_QUERY_KEY_ROOT, "stages"],
    queryFn: () => apiGet<{ data: PipelineStageResponse[] }>("/api/v1/pipeline/stages"),
    staleTime: 60_000,
  });
}

/** GET /pipeline/summary — per-stage + open totals, computed server-side (3.2). */
export function usePipelineSummary() {
  return useQuery({
    queryKey: [PIPELINE_QUERY_KEY_ROOT, "summary"],
    queryFn: () => apiGet<PipelineSummaryResponse>("/api/v1/pipeline/summary"),
  });
}
