import { Suspense } from "react";
import { LeadsPageClient } from "@/components/leads/leads-page-client";
import { Skeleton } from "@/components/ui/skeleton";

// Thin Server Component wrapper (D31, PROJECT-STATE §12).
export const instant = false;

function LeadsPageSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="ml-auto h-(--control-md) w-28" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export default function LeadsPage() {
  return (
    <Suspense fallback={<LeadsPageSkeleton />}>
      <LeadsPageClient />
    </Suspense>
  );
}
