import { useQuery } from "@tanstack/react-query";
import type { LeadResponse, LeadStatusHistoryResponse } from "@growspark/shared";
import { apiGet } from "@/lib/api-client";

export interface LeadsListParams {
  page?: number;
  pageSize?: number;
  q?: string;
  status?: string;
  sourceId?: string;
  ownerId?: string;
  priority?: string;
  archived?: boolean;
  createdFrom?: string;
  createdTo?: string;
  sort?: string;
}

export interface LeadsListResult {
  data: LeadResponse[];
  meta: { page: number; pageSize: number; total: number };
}

export const LEADS_QUERY_KEY_ROOT = "leads" as const;

function buildQuery(params: LeadsListParams): string {
  const searchParams = new URLSearchParams();
  searchParams.set("page", String(params.page ?? 1));
  searchParams.set("pageSize", String(params.pageSize ?? 25));
  if (params.q) searchParams.set("q", params.q);
  if (params.status) searchParams.set("status", params.status);
  if (params.sourceId) searchParams.set("sourceId", params.sourceId);
  if (params.ownerId) searchParams.set("ownerId", params.ownerId);
  if (params.priority) searchParams.set("priority", params.priority);
  if (params.archived !== undefined) searchParams.set("archived", String(params.archived));
  if (params.createdFrom) searchParams.set("createdFrom", params.createdFrom);
  if (params.createdTo) searchParams.set("createdTo", params.createdTo);
  if (params.sort) searchParams.set("sort", params.sort);
  return searchParams.toString();
}

export function useLeadsList(params: LeadsListParams) {
  return useQuery({
    queryKey: [LEADS_QUERY_KEY_ROOT, params],
    queryFn: () => apiGet<LeadsListResult>(`/api/v1/leads?${buildQuery(params)}`),
    placeholderData: (previous) => previous,
  });
}

export function useLead(id: string | undefined) {
  return useQuery({
    queryKey: [LEADS_QUERY_KEY_ROOT, "detail", id],
    queryFn: () => apiGet<{ data: LeadResponse }>(`/api/v1/leads/${id}`),
    enabled: Boolean(id),
  });
}

export function useLeadStatusHistory(id: string | undefined) {
  return useQuery({
    queryKey: [LEADS_QUERY_KEY_ROOT, "status-history", id],
    queryFn: () => apiGet<{ data: LeadStatusHistoryResponse[] }>(`/api/v1/leads/${id}/status-history`),
    enabled: Boolean(id),
  });
}
