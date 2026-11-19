"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Keeps a list page's page/pageSize/sort/filters in the URL's query string
 * (via router.replace, no history entry per keystroke) rather than
 * component state, so back/forward and shared/copy-pasted links reproduce
 * the same view. Each page reads its own specific filter values straight
 * off the returned `searchParams` (shapes differ too much per resource —
 * leads has five filters, companies has one — to generalise further than
 * this) and calls `setParams` to update any subset of them at once.
 */
export function useListUrlState(defaults: { page?: number; pageSize?: number } = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const page = Number(searchParams.get("page") ?? defaults.page ?? 1) || 1;
  const pageSize = Number(searchParams.get("pageSize") ?? defaults.pageSize ?? 25) || 25;

  /**
   * Merges `updates` into the current query string; a value of undefined or
   * "" removes that key. Setting any filter/search/sort value also resets
   * `page` back to 1, unless the caller explicitly includes `page` itself
   * in `updates` (e.g. the Previous/Next buttons do).
   */
  function setParams(updates: Record<string, string | number | undefined>): void {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined || value === "") {
        next.delete(key);
      } else {
        next.set(key, String(value));
      }
    }
    if (!("page" in updates)) {
      next.delete("page");
    }
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  return { searchParams, page, pageSize, setParams };
}
