"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import type { CreateLeadInput, LeadResponse, DuplicateMatch } from "@growspark/shared";
import { apiPost } from "@/lib/api-client";
import { LEADS_QUERY_KEY_ROOT } from "@/hooks/use-leads";
import { LeadForm } from "@/components/leads/lead-form";

export function CreateLeadPageClient() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (values: CreateLeadInput) =>
      apiPost<{ data: LeadResponse; duplicates: DuplicateMatch[] }>("/api/v1/leads", values),
    onSuccess: (result) => {
      toast.success(`${result.data.firstName} was added.`);
      void queryClient.invalidateQueries({ queryKey: [LEADS_QUERY_KEY_ROOT] });
      router.push(`/leads/${result.data.id}`);
    },
  });

  return (
    <div className="max-w-3xl space-y-6">
      <h2 className="h1">Add lead</h2>
      <LeadForm
        mode="create"
        onSubmit={(values) => mutation.mutateAsync(values)}
        submitLabel="Add lead"
        pendingLabel="Adding…"
        onCancel={() => router.push("/leads")}
      />
    </div>
  );
}
