import { Suspense } from "react";
import { LeadDetailPageClient } from "@/components/leads/lead-detail-page-client";
import { Skeleton } from "@/components/ui/skeleton";

// Thin Server Component wrapper (D31). See companies/[id]/edit/page.tsx
// for why `params` is awaited inside the Suspense-wrapped inner component.
export const instant = false;

export default function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <LeadDetailPageContent params={params} />
    </Suspense>
  );
}

async function LeadDetailPageContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LeadDetailPageClient leadId={id} />;
}
