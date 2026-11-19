import { useQuery } from "@tanstack/react-query";
import type { ROLES, UserResponse } from "@growspark/shared";
import { apiGet } from "@/lib/api-client";

export interface UsersListParams {
  page: number;
  pageSize: number;
  q?: string;
  role?: ROLES;
  isActive?: boolean;
}

export interface UsersListResult {
  data: UserResponse[];
  meta: { page: number; pageSize: number; total: number };
}

function buildQuery(params: UsersListParams): string {
  const searchParams = new URLSearchParams();
  searchParams.set("page", String(params.page));
  searchParams.set("pageSize", String(params.pageSize));
  if (params.q) {
    searchParams.set("q", params.q);
  }
  if (params.role) {
    searchParams.set("role", params.role);
  }
  if (params.isActive !== undefined) {
    searchParams.set("isActive", String(params.isActive));
  }
  return searchParams.toString();
}

export const USERS_QUERY_KEY_ROOT = "users" as const;

export function useUsersList(params: UsersListParams) {
  return useQuery({
    queryKey: [USERS_QUERY_KEY_ROOT, params],
    queryFn: () => apiGet<UsersListResult>(`/api/v1/users?${buildQuery(params)}`),
    placeholderData: (previous) => previous,
  });
}
