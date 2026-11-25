import { useQuery } from "@tanstack/react-query";
import { SEARCH_MIN_LENGTH, type SearchResponse } from "@growspark/shared";
import { apiGet } from "@/lib/api-client";

/** GET /search — only fires once the (already debounced, trimmed) text is long enough (D94). */
export function useGlobalSearch(q: string) {
  return useQuery({
    queryKey: ["search", q],
    queryFn: () => apiGet<SearchResponse>(`/api/v1/search?q=${encodeURIComponent(q)}`),
    enabled: q.length >= SEARCH_MIN_LENGTH,
    staleTime: 30_000,
    // Keep the previous results on screen while the next word's request is in flight.
    placeholderData: (previous) => previous,
  });
}
