import { Suspense } from "react";
import { EditCompanyPageClient } from "@/components/companies/edit-company-page-client";
import { Skeleton } from "@/components/ui/skeleton";

// Thin Server Component wrapper (D31, PROJECT-STATE §12). `params` is a
// Promise in Next.js 16 and, with Cache Components enabled, must be awaited
// behind a <Suspense> boundary (see Next's own dynamic-routes.md, "Without
// generateStaticParams") — awaited in the small async inner component below,
// not at this top level, so this page still prerenders a static shell.
export const instant = false;

export default function EditCompanyPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full max-w-3xl" />}>
      <EditCompanyPageContent params={params} />
    </Suspense>
  );
}

async function EditCompanyPageContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EditCompanyPageClient companyId={id} />;
}
