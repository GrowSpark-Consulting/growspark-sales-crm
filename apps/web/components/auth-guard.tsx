"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useMe, ME_QUERY_KEY } from "@/hooks/use-me";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Client-side only. This is a navigation convenience, not the security
 * control — the API enforces session/permission on every request
 * regardless of what this component does (per the brief: Next 16's
 * proxy.ts, like middleware.ts before it, must never be relied on for
 * security). An attacker bypassing this guard entirely still hits a 401/403
 * at the API.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { data, isLoading, isError } = useMe();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const hasMountedRef = useRef(false);

  useEffect(() => {
    if (!isLoading && (isError || !data)) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [isLoading, isError, data, pathname, router]);

  // Revalidate /auth/me on every route change inside the protected shell
  // (not the first mount — useMe() already fetches then), so a user
  // deactivated elsewhere is signed out on their next navigation, without
  // needing a manual refresh.
  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
  }, [pathname, queryClient]);

  if (isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <div className="w-64 space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    // Redirecting via the effect above — render nothing in the meantime.
    return null;
  }

  return <>{children}</>;
}
