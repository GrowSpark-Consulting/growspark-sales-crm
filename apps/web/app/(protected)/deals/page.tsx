import { Suspense } from "react";
import { DealsPageClient } from "@/components/deals/deals-page-client";
import { Skeleton } from "@/components/ui/skeleton";

// Thin Server Component wrapper (D31, PROJECT-STATE §12): carries its own
// `instant` export; the Client Component (useSearchParams for URL-driven
// filters) lives separately and needs the Suspense boundary below (same
// pattern as /companies, D37).
export const instant = false;

function DealsPageSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="ml-auto h-(--control-md) w-36" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export default function DealsPage() {
  return (
    <Suspense fallback={<DealsPageSkeleton />}>
      <DealsPageClient />
    </Suspense>
  );
}
