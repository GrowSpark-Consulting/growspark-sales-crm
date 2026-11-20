"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import type { CreateDealInput, DealResponse } from "@growspark/shared";
import { apiPatch } from "@/lib/api-client";
import { DEALS_QUERY_KEY_ROOT, useDeal } from "@/hooks/use-deals";
import { PIPELINE_QUERY_KEY_ROOT } from "@/hooks/use-pipeline";
import { DealForm } from "@/components/deals/deal-form";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function EditDealPageClient({ dealId }: { dealId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const dealQuery = useDeal(dealId);

  const mutation = useMutation({
    mutationFn: (values: CreateDealInput) => apiPatch<{ data: DealResponse }>(`/api/v1/deals/${dealId}`, values),
    onSuccess: (result) => {
      toast.success(`${result.data.name} was updated.`);
      void queryClient.invalidateQueries({ queryKey: [DEALS_QUERY_KEY_ROOT] });
      void queryClient.invalidateQueries({ queryKey: [PIPELINE_QUERY_KEY_ROOT] });
      router.push(`/deals/${dealId}`);
    },
  });

  if (dealQuery.isLoading) {
    return (
      <div className="max-w-3xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (dealQuery.isError || !dealQuery.data) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Could not load this deal.</AlertDescription>
      </Alert>
    );
  }

  const deal = dealQuery.data.data;

  if (deal.status !== "OPEN") {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          A closed deal is read-only. Reopen it from the deal page before editing.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <h2 className="h1">Edit {deal.name}</h2>
      <DealForm
        deal={deal}
        onSubmit={(values) => mutation.mutateAsync(values)}
        submitLabel="Save changes"
        pendingLabel="Saving…"
        onCancel={() => router.push(`/deals/${dealId}`)}
      />
    </div>
  );
}
