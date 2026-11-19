import { useQuery } from "@tanstack/react-query";
import type { MeResponse } from "@growspark/shared";
import { apiGet } from "@/lib/api-client";

export const ME_QUERY_KEY = ["me"] as const;

export function useMe() {
  return useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: () => apiGet<{ data: MeResponse }>("/api/v1/auth/me"),
    retry: false,
    staleTime: 60_000,
    // Overrides the QueryClient default (refetchOnWindowFocus: false) for
    // this one query — a deactivated user should be signed out on their
    // next window focus, not just their next navigation.
    refetchOnWindowFocus: true,
  });
}
