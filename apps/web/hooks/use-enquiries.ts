import { useQuery } from "@tanstack/react-query";
import type { EnquiryResponse, EnquiryDetailResponse } from "@growspark/shared";
import { apiGet } from "@/lib/api-client";

export interface EnquiriesListParams {
  page?: number;
  pageSize?: number;
  status?: string;
  formType?: string;
  archived?: boolean;
  receivedFrom?: string;
  receivedTo?: string;
  sort?: string;
}

export interface EnquiriesListResult {
  data: EnquiryResponse[];
  meta: { page: number; pageSize: number; total: number };
}

export const ENQUIRIES_QUERY_KEY_ROOT = "enquiries" as const;

function buildQuery(params: EnquiriesListParams): string {
  const searchParams = new URLSearchParams();
  searchParams.set("page", String(params.page ?? 1));
  searchParams.set("pageSize", String(params.pageSize ?? 25));
  if (params.status) searchParams.set("status", params.status);
  if (params.formType) searchParams.set("formType", params.formType);
  if (params.archived !== undefined) searchParams.set("archived", String(params.archived));
  if (params.receivedFrom) searchParams.set("receivedFrom", params.receivedFrom);
  if (params.receivedTo) searchParams.set("receivedTo", params.receivedTo);
  if (params.sort) searchParams.set("sort", params.sort);
  return searchParams.toString();
}

export function useEnquiriesList(params: EnquiriesListParams) {
  return useQuery({
    queryKey: [ENQUIRIES_QUERY_KEY_ROOT, params],
    queryFn: () => apiGet<EnquiriesListResult>(`/api/v1/enquiries?${buildQuery(params)}`),
    placeholderData: (previous) => previous,
  });
}

export function useEnquiry(id: string | undefined) {
  return useQuery({
    queryKey: [ENQUIRIES_QUERY_KEY_ROOT, "detail", id],
    queryFn: () => apiGet<EnquiryDetailResponse>(`/api/v1/enquiries/${id}`),
    enabled: Boolean(id),
  });
}
