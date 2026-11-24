"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateQuotationInput, QuotationResponse } from "@growspark/shared";
import { apiPost } from "@/lib/api-client";
import { useMe } from "@/hooks/use-me";
import { QUOTATIONS_QUERY_KEY_ROOT } from "@/hooks/use-quotations";
import { QuotationForm } from "@/components/quotations/quotation-form";

export function CreateQuotationPageClient() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: meData } = useMe();
  const searchParams = useSearchParams();
  // "Add quotation" from a Deal or Company page links here with ?companyId=
  // (and ?dealId=), so the form opens with those already chosen.
  const defaultCompanyId = searchParams.get("companyId") ?? undefined;
  const defaultDealId = searchParams.get("dealId") ?? undefined;

  const mutation = useMutation({
    mutationFn: (values: CreateQuotationInput) => apiPost<{ data: QuotationResponse }>("/api/v1/quotations", values),
    onSuccess: (result) => {
      toast.success(`Quotation ${result.data.number} was created.`);
      void queryClient.invalidateQueries({ queryKey: [QUOTATIONS_QUERY_KEY_ROOT] });
      router.push(`/quotations/${result.data.id}`);
    },
  });

  return (
    <div className="max-w-5xl space-y-6">
      <h2 className="h1">New quotation</h2>
      <QuotationForm
        defaultOwnerId={meData?.data.user.id}
        defaultCompanyId={defaultCompanyId}
        defaultDealId={defaultDealId}
        onSubmit={(values) => mutation.mutateAsync(values)}
        submitLabel="Create quotation"
        pendingLabel="Creating…"
        onCancel={() => router.back()}
      />
    </div>
  );
}
