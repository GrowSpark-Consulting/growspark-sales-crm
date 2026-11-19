"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import type { CreateCompanyInput, CompanyResponse, DuplicateMatch } from "@growspark/shared";
import { apiPatch } from "@/lib/api-client";
import { COMPANIES_QUERY_KEY_ROOT, useCompany } from "@/hooks/use-companies";
import { CompanyForm } from "@/components/companies/company-form";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function EditCompanyPageClient({ companyId }: { companyId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const companyQuery = useCompany(companyId);

  const mutation = useMutation({
    mutationFn: (values: CreateCompanyInput) =>
      apiPatch<{ data: CompanyResponse; duplicates: DuplicateMatch[] }>(`/api/v1/companies/${companyId}`, values),
    onSuccess: (result) => {
      toast.success(`${result.data.name} was updated.`);
      void queryClient.invalidateQueries({ queryKey: [COMPANIES_QUERY_KEY_ROOT] });
      router.push(`/companies/${companyId}`);
    },
  });

  if (companyQuery.isLoading) {
    return (
      <div className="max-w-3xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (companyQuery.isError || !companyQuery.data) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Could not load this company.</AlertDescription>
      </Alert>
    );
  }

  const company = companyQuery.data.data;

  return (
    <div className="max-w-3xl space-y-6">
      <h2 className="h1">Edit {company.name}</h2>
      <CompanyForm
        company={company}
        onSubmit={(values) => mutation.mutateAsync(values)}
        submitLabel="Save changes"
        pendingLabel="Saving…"
        onCancel={() => router.push(`/companies/${companyId}`)}
      />
    </div>
  );
}
