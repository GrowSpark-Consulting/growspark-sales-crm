import { Suspense } from "react";
import { QuotationsPageClient } from "@/components/quotations/quotations-page-client";
import { Skeleton } from "@/components/ui/skeleton";

// Thin Server Component wrapper (D31); the client list reads useSearchParams,
// so it needs a real Suspense fallback (D26).
export const instant = false;

function QuotationsPageSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="ml-auto h-(--control-md) w-40" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export default function QuotationsPage() {
  return (
    <Suspense fallback={<QuotationsPageSkeleton />}>
      <QuotationsPageClient />
    </Suspense>
  );
}
