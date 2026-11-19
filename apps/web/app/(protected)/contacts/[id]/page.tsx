import { Suspense } from "react";
import { ContactDetailPageClient } from "@/components/contacts/contact-detail-page-client";
import { Skeleton } from "@/components/ui/skeleton";

// Thin Server Component wrapper (D31). `params` is a Promise in Next.js 16
// and must be awaited behind a <Suspense> boundary with Cache Components
// on — see companies/[id]/edit/page.tsx for the same pattern.
export const instant = false;

export default function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <ContactDetailPageContent params={params} />
    </Suspense>
  );
}

async function ContactDetailPageContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ContactDetailPageClient contactId={id} />;
}
