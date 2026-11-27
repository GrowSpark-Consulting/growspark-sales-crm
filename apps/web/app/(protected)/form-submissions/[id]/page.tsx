import { Suspense } from "react";
import { EnquiryDetailPageClient } from "@/components/enquiries/enquiry-detail-page-client";
import { Skeleton } from "@/components/ui/skeleton";

// Thin Server Component wrapper (D31). See companies/[id]/page.tsx for why
// `params` is awaited inside the Suspense-wrapped inner component.
export const instant = false;

export default function EnquiryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <EnquiryDetailPageContent params={params} />
    </Suspense>
  );
}

async function EnquiryDetailPageContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EnquiryDetailPageClient enquiryId={id} />;
}
