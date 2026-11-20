import { Suspense } from "react";
import { DealDetailPageClient } from "@/components/deals/deal-detail-page-client";
import { Skeleton } from "@/components/ui/skeleton";

// Thin Server Component wrapper (D31). See [id]/edit/page.tsx for why
// `params` is awaited inside the Suspense-wrapped inner component.
export const instant = false;

export default function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <DealDetailPageContent params={params} />
    </Suspense>
  );
}

async function DealDetailPageContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DealDetailPageClient dealId={id} />;
}
