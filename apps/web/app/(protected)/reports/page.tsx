import { Suspense } from "react";
import { ReportsPageClient } from "@/components/reports/reports-page-client";
import { Skeleton } from "@/components/ui/skeleton";

// Thin Server Component wrapper (D31). Suspense wraps the client component
// because it reads URL search params via useSearchParams.
export const instant = false;

export default function ReportsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <ReportsPageClient />
    </Suspense>
  );
}
