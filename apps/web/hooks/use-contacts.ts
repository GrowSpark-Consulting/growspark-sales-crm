import { useQuery } from "@tanstack/react-query";
import type { ContactResponse } from "@growspark/shared";
import { apiGet } from "@/lib/api-client";

export interface ContactsListParams {
  page?: number;
  pageSize?: number;
  q?: string;
  archived?: boolean;
  companyId?: string;
  ownerId?: string;
  sort?: string;
}

export interface ContactsListResult {
  data: ContactResponse[];
  meta: { page: number; pageSize: number; total: number };
}

export const CONTACTS_QUERY_KEY_ROOT = "contacts" as const;

function buildQuery(params: ContactsListParams): string {
  const searchParams = new URLSearchParams();
  searchParams.set("page", String(params.page ?? 1));
  searchParams.set("pageSize", String(params.pageSize ?? 25));
  if (params.q) searchParams.set("q", params.q);
  if (params.archived !== undefined) searchParams.set("archived", String(params.archived));
  if (params.companyId) searchParams.set("companyId", params.companyId);
  if (params.ownerId) searchParams.set("ownerId", params.ownerId);
  if (params.sort) searchParams.set("sort", params.sort);
  return searchParams.toString();
}

export function useContactsList(params: ContactsListParams) {
  return useQuery({
    queryKey: [CONTACTS_QUERY_KEY_ROOT, params],
    queryFn: () => apiGet<ContactsListResult>(`/api/v1/contacts?${buildQuery(params)}`),
    placeholderData: (previous) => previous,
  });
}

export function useContact(id: string | undefined) {
  return useQuery({
    queryKey: [CONTACTS_QUERY_KEY_ROOT, "detail", id],
    queryFn: () => apiGet<{ data: ContactResponse }>(`/api/v1/contacts/${id}`),
    enabled: Boolean(id),
  });
}
