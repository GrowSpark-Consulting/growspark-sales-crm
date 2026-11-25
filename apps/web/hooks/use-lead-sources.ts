import { useQuery } from "@tanstack/react-query";
import type { LeadSourceResponse } from "@growspark/shared";
import { apiGet } from "@/lib/api-client";

/**
 * GET /lead-sources, ordered for a dropdown (2.1). Active sources only by
 * default; `includeInactive` also returns retired ones (each with isActive),
 * for screens that must still name the source a record already has (D93).
 */
export function useLeadSources({ includeInactive = false }: { includeInactive?: boolean } = {}) {
  return useQuery({
    queryKey: ["lead-sources", { includeInactive }],
    queryFn: () =>
      apiGet<{ data: LeadSourceResponse[] }>(
        includeInactive ? "/api/v1/lead-sources?includeInactive=true" : "/api/v1/lead-sources"
      ),
    staleTime: 60_000,
  });
}

/**
 * What a create/edit form's Source select offers: every active source, plus
 * the record's own current source even if it has since been deactivated
 * (labelled so), so editing an older record never blanks its source.
 */
export function selectableLeadSources(
  sources: LeadSourceResponse[],
  currentSourceId: string | null | undefined
): (LeadSourceResponse & { label: string })[] {
  return sources
    .filter((source) => source.isActive || source.id === currentSourceId)
    .map((source) => ({ ...source, label: source.isActive ? source.name : `${source.name} (inactive)` }));
}
