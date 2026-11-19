import { Suspense } from "react";
import { CompanyDetailPageClient } from "@/components/companies/company-detail-page-client";
import { Skeleton } from "@/components/ui/skeleton";

// Thin Server Component wrapper (D31). See [id]/edit/page.tsx for why
// `params` is awaited inside the Suspense-wrapped inner component.
export const instant = false;

export default function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <CompanyDetailPageContent params={params} />
    </Suspense>
  );
}

async function CompanyDetailPageContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CompanyDetailPageClient companyId={id} />;
}
