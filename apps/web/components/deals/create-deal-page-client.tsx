"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import type { CreateDealInput, DealResponse } from "@growspark/shared";
import { apiPost } from "@/lib/api-client";
import { useMe } from "@/hooks/use-me";
import { DEALS_QUERY_KEY_ROOT } from "@/hooks/use-deals";
import { PIPELINE_QUERY_KEY_ROOT } from "@/hooks/use-pipeline";
import { DealForm } from "@/components/deals/deal-form";

export function CreateDealPageClient() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: meData } = useMe();
  const me = meData?.data;
  const searchParams = useSearchParams();
  // "Add deal" from a Company's own Deals tab (3.5) links here with
  // ?companyId=, so the form opens with that company already chosen —
  // still editable, just a sensible default.
  const defaultCompanyId = searchParams.get("companyId") ?? undefined;

  const mutation = useMutation({
    mutationFn: (values: CreateDealInput) => apiPost<{ data: DealResponse }>("/api/v1/deals", values),
    onSuccess: (result) => {
      toast.success(`${result.data.name} was added.`);
      void queryClient.invalidateQueries({ queryKey: [DEALS_QUERY_KEY_ROOT] });
      void queryClient.invalidateQueries({ queryKey: [PIPELINE_QUERY_KEY_ROOT] });
      router.push(`/deals/${result.data.id}`);
    },
  });

  return (
    <div className="max-w-3xl space-y-6">
      <h2 className="h1">Add deal</h2>
      <DealForm
        defaultOwnerId={me?.user.id}
        defaultCompanyId={defaultCompanyId}
        onSubmit={(values) => mutation.mutateAsync(values)}
        submitLabel="Add deal"
        pendingLabel="Adding…"
        onCancel={() => router.push("/deals")}
      />
    </div>
  );
}
