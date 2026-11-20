import { Suspense } from "react";
import { CreateDealPageClient } from "@/components/deals/create-deal-page-client";
import { Skeleton } from "@/components/ui/skeleton";

// Thin Server Component wrapper (D31, PROJECT-STATE §12). CreateDealPageClient
// reads useSearchParams() (3.5's ?companyId= prefill), so it needs a real
// <Suspense> boundary here — same requirement as /login (D26) and /deals (D48).
export const instant = false;

export default function NewDealPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full max-w-3xl" />}>
      <CreateDealPageClient />
    </Suspense>
  );
}
