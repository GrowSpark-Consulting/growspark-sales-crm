import { useQuery } from "@tanstack/react-query";
import type { LeadSourceResponse } from "@growspark/shared";
import { apiGet } from "@/lib/api-client";

/** GET /lead-sources — active sources only, ordered for a dropdown (2.1). */
export function useLeadSources() {
  return useQuery({
    queryKey: ["lead-sources"],
    queryFn: () => apiGet<{ data: LeadSourceResponse[] }>("/api/v1/lead-sources"),
    staleTime: 60_000,
  });
}
