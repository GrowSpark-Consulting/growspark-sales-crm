import { Suspense } from "react";
import { DashboardPageClient } from "@/components/dashboard/dashboard-page-client";
import { Skeleton } from "@/components/ui/skeleton";

// Thin Server Component wrapper; DashboardPageClient reads useSearchParams()
// (the date-range and scope controls), so it needs its own Suspense boundary
// per D26's rule. Every page.tsx under (protected) also carries its own
// `instant` export per the convention in D31 / PROJECT-STATE §12.
export const instant = false;

export default function HomePage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <DashboardPageClient />
    </Suspense>
  );
}
