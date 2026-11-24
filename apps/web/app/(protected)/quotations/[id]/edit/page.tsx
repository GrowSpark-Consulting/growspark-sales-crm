import { Suspense } from "react";
import { EditQuotationPageClient } from "@/components/quotations/edit-quotation-page-client";
import { Skeleton } from "@/components/ui/skeleton";

// Thin Server Component wrapper (D31), same params pattern as [id]/page.tsx.
export const instant = false;

export default function EditQuotationPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full max-w-5xl" />}>
      <EditQuotationPageContent params={params} />
    </Suspense>
  );
}

async function EditQuotationPageContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EditQuotationPageClient quotationId={id} />;
}
