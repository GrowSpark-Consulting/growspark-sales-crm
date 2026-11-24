import { Suspense } from "react";
import { CreateQuotationPageClient } from "@/components/quotations/create-quotation-page-client";
import { Skeleton } from "@/components/ui/skeleton";

// Thin Server Component wrapper (D31). The client reads ?companyId=/?dealId=
// via useSearchParams, so it needs a real Suspense boundary (D26).
export const instant = false;

export default function NewQuotationPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full max-w-5xl" />}>
      <CreateQuotationPageClient />
    </Suspense>
  );
}
