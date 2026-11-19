"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { onUnauthorized } from "@/lib/api-client";

/**
 * App-wide: registers a single listener for a 401 from ANY apiGet/apiPost/
 * apiPatch call. On a real session expiry, clears the query cache and sends
 * the user to /login?next=<path they were on>, once. Two guards keep a
 * burst of parallel requests (or /login's own failed-login 401, which is
 * not a session expiry) from causing a redirect loop: a synchronous
 * "already redirecting" ref, and skipping entirely while already on
 * /login.
 */
export function SessionExpiryHandler() {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const redirectingRef = useRef(false);

  useEffect(() => {
    redirectingRef.current = false;
  }, [pathname]);

  useEffect(() => {
    onUnauthorized(() => {
      if (redirectingRef.current || pathname === "/login") {
        return;
      }
      redirectingRef.current = true;
      queryClient.clear();
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    });
    return () => onUnauthorized(null);
  }, [router, pathname, queryClient]);

  return null;
}
