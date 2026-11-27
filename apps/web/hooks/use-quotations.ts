import { useQuery } from "@tanstack/react-query";
import type { QuotationResponse } from "@growspark/shared";
import { apiGet } from "@/lib/api-client";

export interface QuotationsListParams {
  page?: number;
  pageSize?: number;
  q?: string;
  status?: string;
  companyId?: string;
  contactId?: string;
  dealId?: string;
  ownerId?: string;
  issuedFrom?: string;
  issuedTo?: string;
  archived?: boolean;
  sort?: string;
}

export interface QuotationsListResult {
  data: QuotationResponse[];
  meta: { page: number; pageSize: number; total: number };
}

export const QUOTATIONS_QUERY_KEY_ROOT = "quotations" as const;

function buildQuery(params: QuotationsListParams): string {
  const searchParams = new URLSearchParams();
  searchParams.set("page", String(params.page ?? 1));
  searchParams.set("pageSize", String(params.pageSize ?? 25));
  for (const key of ["q", "status", "companyId", "contactId", "dealId", "ownerId", "issuedFrom", "issuedTo", "sort"] as const) {
    const value = params[key];
    if (value) searchParams.set(key, value);
  }
  if (params.archived !== undefined) searchParams.set("archived", String(params.archived));
  return searchParams.toString();
}

export function useQuotationsList(params: QuotationsListParams) {
  return useQuery({
    queryKey: [QUOTATIONS_QUERY_KEY_ROOT, params],
    queryFn: () => apiGet<QuotationsListResult>(`/api/v1/quotations?${buildQuery(params)}`),
    placeholderData: (previous) => previous,
  });
}

export function useQuotation(id: string | undefined) {
  return useQuery({
    queryKey: [QUOTATIONS_QUERY_KEY_ROOT, "detail", id],
    queryFn: () => apiGet<{ data: QuotationResponse }>(`/api/v1/quotations/${id}`),
    enabled: Boolean(id),
  });
}

export function quotationPdfHref(id: string): string {
  return `/api/v1/quotations/${id}/pdf`;
}
