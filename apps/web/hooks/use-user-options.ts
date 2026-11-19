import { useQuery } from "@tanstack/react-query";
import type { UserOptionResponse } from "@growspark/shared";
import { apiGet } from "@/lib/api-client";

export interface UserOptionsResult {
  data: UserOptionResponse[];
}

export const USER_OPTIONS_QUERY_KEY = ["user-options"] as const;

/** GET /users/options — active users' id+name, for owner pickers. Any signed-in role may call it. */
export function useUserOptions() {
  return useQuery({
    queryKey: USER_OPTIONS_QUERY_KEY,
    queryFn: () => apiGet<UserOptionsResult>("/api/v1/users/options"),
    staleTime: 60_000,
  });
}
