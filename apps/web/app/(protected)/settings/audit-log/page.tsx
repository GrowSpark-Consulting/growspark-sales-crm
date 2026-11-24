import { Suspense } from "react";
import { AuditLogPageClient } from "@/components/audit/audit-log-page-client";
import { Skeleton } from "@/components/ui/skeleton";

// Thin Server Component wrapper (D31, PROJECT-STATE §12): carries its own
// `instant` export; the Client Component (useSearchParams for URL-driven
// filters) lives separately and needs the Suspense boundary below (same
// pattern as /companies, D37).
export const instant = false;

function AuditLogSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export default function AuditLogPage() {
  return (
    <Suspense fallback={<AuditLogSkeleton />}>
      <AuditLogPageClient />
    </Suspense>
  );
}
