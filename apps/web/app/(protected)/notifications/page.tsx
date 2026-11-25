import { Suspense } from "react";
import { NotificationsPageClient } from "@/components/notifications/notifications-page-client";
import { Skeleton } from "@/components/ui/skeleton";

// Thin Server Component wrapper (D31). Suspense wraps the client component
// because it reads URL search params via useSearchParams.
export const instant = false;

export default function NotificationsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <NotificationsPageClient />
    </Suspense>
  );
}
