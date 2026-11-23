import { Suspense } from "react";
import { TodayPageClient } from "@/components/workspace/today-page-client";
import { Skeleton } from "@/components/ui/skeleton";

export const instant = false;
export default function TodayPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <TodayPageClient />
    </Suspense>
  );
}
