import { useQuery } from "@tanstack/react-query";
import type { DealResponse, DealStageHistoryResponse } from "@growspark/shared";
import { apiGet } from "@/lib/api-client";

export interface DealsListParams {
  page?: number;
  pageSize?: number;
  q?: string;
  status?: string;
  stageId?: string;
  companyId?: string;
  contactId?: string;
  ownerId?: string;
  archived?: boolean;
  sort?: string;
}

export interface DealsListResult {
  data: DealResponse[];
  meta: { page: number; pageSize: number; total: number };
}

export const DEALS_QUERY_KEY_ROOT = "deals" as const;

function buildQuery(params: DealsListParams): string {
  const searchParams = new URLSearchParams();
  searchParams.set("page", String(params.page ?? 1));
  searchParams.set("pageSize", String(params.pageSize ?? 25));
  if (params.q) searchParams.set("q", params.q);
  if (params.status) searchParams.set("status", params.status);
  if (params.stageId) searchParams.set("stageId", params.stageId);
  if (params.companyId) searchParams.set("companyId", params.companyId);
  if (params.contactId) searchParams.set("contactId", params.contactId);
  if (params.ownerId) searchParams.set("ownerId", params.ownerId);
  if (params.archived !== undefined) searchParams.set("archived", String(params.archived));
  if (params.sort) searchParams.set("sort", params.sort);
  return searchParams.toString();
}

export function useDealsList(params: DealsListParams) {
  return useQuery({
    queryKey: [DEALS_QUERY_KEY_ROOT, params],
    queryFn: () => apiGet<DealsListResult>(`/api/v1/deals?${buildQuery(params)}`),
    placeholderData: (previous) => previous,
  });
}

export function useDeal(id: string | undefined) {
  return useQuery({
    queryKey: [DEALS_QUERY_KEY_ROOT, "detail", id],
    queryFn: () => apiGet<{ data: DealResponse }>(`/api/v1/deals/${id}`),
    enabled: Boolean(id),
  });
}

export function useDealStageHistory(id: string | undefined) {
  return useQuery({
    queryKey: [DEALS_QUERY_KEY_ROOT, "stage-history", id],
    queryFn: () => apiGet<{ data: DealStageHistoryResponse[] }>(`/api/v1/deals/${id}/stage-history`),
    enabled: Boolean(id),
  });
}
