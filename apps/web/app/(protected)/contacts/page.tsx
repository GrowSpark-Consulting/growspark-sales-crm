import { Suspense } from "react";
import { ContactsPageClient } from "@/components/contacts/contacts-page-client";
import { Skeleton } from "@/components/ui/skeleton";

// Thin Server Component wrapper (D31, PROJECT-STATE §12).
export const instant = false;

function ContactsPageSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="ml-auto h-(--control-md) w-36" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export default function ContactsPage() {
  return (
    <Suspense fallback={<ContactsPageSkeleton />}>
      <ContactsPageClient />
    </Suspense>
  );
}
