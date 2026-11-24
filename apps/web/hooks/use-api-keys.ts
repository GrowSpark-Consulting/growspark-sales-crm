import { useQuery } from "@tanstack/react-query";
import type { ApiKeyResponse } from "@growspark/shared";
import { apiGet } from "@/lib/api-client";

export interface ApiKeysListParams {
  page?: number;
  pageSize?: number;
}

export interface ApiKeysListResult {
  data: ApiKeyResponse[];
  meta: { page: number; pageSize: number; total: number };
}

export const API_KEYS_QUERY_KEY_ROOT = "api-keys" as const;

function buildQuery(params: ApiKeysListParams): string {
  const searchParams = new URLSearchParams();
  searchParams.set("page", String(params.page ?? 1));
  searchParams.set("pageSize", String(params.pageSize ?? 25));
  return searchParams.toString();
}

export function useApiKeysList(params: ApiKeysListParams) {
  return useQuery({
    queryKey: [API_KEYS_QUERY_KEY_ROOT, params],
    queryFn: () => apiGet<ApiKeysListResult>(`/api/v1/api-keys?${buildQuery(params)}`),
    placeholderData: (previous) => previous,
  });
}
