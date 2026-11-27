import { Suspense } from "react";
import { EnquiriesPageClient } from "@/components/enquiries/enquiries-page-client";
import { Skeleton } from "@/components/ui/skeleton";

// Thin Server Component wrapper (D31). Suspense wraps the client component
// because it reads URL search params via useSearchParams (same reasoning as
// the Leads/Companies/Contacts list pages).
export const instant = false;

export default function EnquiriesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <EnquiriesPageClient />
    </Suspense>
  );
}
