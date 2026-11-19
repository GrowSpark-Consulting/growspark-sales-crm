import { useQuery } from "@tanstack/react-query";
import type { CompanyResponse } from "@growspark/shared";
import { apiGet } from "@/lib/api-client";

export interface CompaniesListParams {
  page?: number;
  pageSize?: number;
  q?: string;
  archived?: boolean;
  ownerId?: string;
  sort?: string;
}

export interface CompaniesListResult {
  data: CompanyResponse[];
  meta: { page: number; pageSize: number; total: number };
}

export const COMPANIES_QUERY_KEY_ROOT = "companies" as const;

function buildQuery(params: CompaniesListParams): string {
  const searchParams = new URLSearchParams();
  searchParams.set("page", String(params.page ?? 1));
  searchParams.set("pageSize", String(params.pageSize ?? 25));
  if (params.q) searchParams.set("q", params.q);
  if (params.archived !== undefined) searchParams.set("archived", String(params.archived));
  if (params.ownerId) searchParams.set("ownerId", params.ownerId);
  if (params.sort) searchParams.set("sort", params.sort);
  return searchParams.toString();
}

export function useCompaniesList(params: CompaniesListParams) {
  return useQuery({
    queryKey: [COMPANIES_QUERY_KEY_ROOT, params],
    queryFn: () => apiGet<CompaniesListResult>(`/api/v1/companies?${buildQuery(params)}`),
    placeholderData: (previous) => previous,
  });
}

export function useCompany(id: string | undefined) {
  return useQuery({
    queryKey: [COMPANIES_QUERY_KEY_ROOT, "detail", id],
    queryFn: () => apiGet<{ data: CompanyResponse }>(`/api/v1/companies/${id}`),
    enabled: Boolean(id),
  });
}
