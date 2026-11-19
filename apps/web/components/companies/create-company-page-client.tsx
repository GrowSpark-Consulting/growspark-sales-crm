"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import type { CreateCompanyInput, CompanyResponse, DuplicateMatch } from "@growspark/shared";
import { apiPost } from "@/lib/api-client";
import { COMPANIES_QUERY_KEY_ROOT } from "@/hooks/use-companies";
import { CompanyForm } from "@/components/companies/company-form";

export function CreateCompanyPageClient() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (values: CreateCompanyInput) =>
      apiPost<{ data: CompanyResponse; duplicates: DuplicateMatch[] }>("/api/v1/companies", values),
    onSuccess: (result) => {
      toast.success(`${result.data.name} was added.`);
      void queryClient.invalidateQueries({ queryKey: [COMPANIES_QUERY_KEY_ROOT] });
      router.push(`/companies/${result.data.id}`);
    },
  });

  return (
    <div className="max-w-3xl space-y-6">
      <h2 className="h1">Add company</h2>
      <CompanyForm
        onSubmit={(values) => mutation.mutateAsync(values)}
        submitLabel="Add company"
        pendingLabel="Adding…"
        onCancel={() => router.push("/companies")}
      />
    </div>
  );
}
