import { Suspense } from "react";
import { EditLeadPageClient } from "@/components/leads/edit-lead-page-client";
import { Skeleton } from "@/components/ui/skeleton";

// Thin Server Component wrapper (D31). See companies/[id]/edit/page.tsx
// for why `params` is awaited inside the Suspense-wrapped inner component.
export const instant = false;

export default function EditLeadPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full max-w-3xl" />}>
      <EditLeadPageContent params={params} />
    </Suspense>
  );
}

async function EditLeadPageContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EditLeadPageClient leadId={id} />;
}
