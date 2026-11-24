"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateQuotationInput, QuotationResponse } from "@growspark/shared";
import { apiPatch, ApiError } from "@/lib/api-client";
import { QUOTATIONS_QUERY_KEY_ROOT, useQuotation } from "@/hooks/use-quotations";
import { QuotationForm } from "@/components/quotations/quotation-form";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function EditQuotationPageClient({ quotationId }: { quotationId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const quotationQuery = useQuotation(quotationId);

  const mutation = useMutation({
    mutationFn: (values: CreateQuotationInput) => apiPatch<{ data: QuotationResponse }>(`/api/v1/quotations/${quotationId}`, values),
    onSuccess: (result) => {
      toast.success(`Quotation ${result.data.number} was updated (version ${result.data.version}).`);
      void queryClient.invalidateQueries({ queryKey: [QUOTATIONS_QUERY_KEY_ROOT] });
      router.push(`/quotations/${quotationId}`);
    },
  });

  if (quotationQuery.isLoading) return <Skeleton className="h-96 w-full max-w-5xl" />;

  const quotation = quotationQuery.data?.data;
  if (quotationQuery.isError || !quotation) {
    const notFound = quotationQuery.error instanceof ApiError && quotationQuery.error.status === 404;
    return (
      <Alert variant="destructive">
        <AlertDescription>{notFound ? "This quotation does not exist." : "Could not load this quotation."}</AlertDescription>
      </Alert>
    );
  }

  // A backstop alongside the detail page's hidden Edit button: the server
  // refuses edits outside Draft anyway (409).
  if (quotation.status !== "DRAFT") {
    return (
      <Alert>
        <AlertDescription>
          Only a draft quotation can be edited. <Link href={`/quotations/${quotation.id}`} className="underline">Back to {quotation.number}</Link> — use Duplicate to make a new draft.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="max-w-5xl space-y-6">
      <h2 className="h1">Edit {quotation.number}</h2>
      <QuotationForm
        quotation={quotation}
        onSubmit={(values) => mutation.mutateAsync(values)}
        submitLabel="Save changes"
        pendingLabel="Saving…"
        onCancel={() => router.push(`/quotations/${quotation.id}`)}
      />
    </div>
  );
}
