import { Suspense } from "react";
import { EditDealPageClient } from "@/components/deals/edit-deal-page-client";
import { Skeleton } from "@/components/ui/skeleton";

// Thin Server Component wrapper (D31, PROJECT-STATE §12). `params` is a
// Promise in Next.js 16 and, with Cache Components enabled, must be awaited
// behind a <Suspense> boundary (same pattern as /companies/[id]/edit, D38).
export const instant = false;

export default function EditDealPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full max-w-3xl" />}>
      <EditDealPageContent params={params} />
    </Suspense>
  );
}

async function EditDealPageContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EditDealPageClient dealId={id} />;
}
