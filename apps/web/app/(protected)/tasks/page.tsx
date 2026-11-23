import { Suspense } from "react";
import { TasksPageClient } from "@/components/tasks/tasks-page-client";
import { Skeleton } from "@/components/ui/skeleton";

export const instant = false;
export default function TasksPage() {
  return <Suspense fallback={<Skeleton className="h-64 w-full" />}><TasksPageClient /></Suspense>;
}
