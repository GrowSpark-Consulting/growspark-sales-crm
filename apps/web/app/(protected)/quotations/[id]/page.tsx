import { Suspense } from "react";
import { QuotationDetailPageClient } from "@/components/quotations/quotation-detail-page-client";
import { Skeleton } from "@/components/ui/skeleton";

// Thin Server Component wrapper (D31); `params` is awaited inside the
// Suspense-wrapped inner component (Next 16 + Cache Components).
export const instant = false;

export default function QuotationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <QuotationDetailPageContent params={params} />
    </Suspense>
  );
}

async function QuotationDetailPageContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <QuotationDetailPageClient quotationId={id} />;
}
