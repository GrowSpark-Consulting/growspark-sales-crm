"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import type { CreateLeadInput, LeadResponse, DuplicateMatch } from "@growspark/shared";
import { apiPatch } from "@/lib/api-client";
import { LEADS_QUERY_KEY_ROOT, useLead } from "@/hooks/use-leads";
import { LeadForm } from "@/components/leads/lead-form";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function EditLeadPageClient({ leadId }: { leadId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const leadQuery = useLead(leadId);

  const mutation = useMutation({
    mutationFn: (values: CreateLeadInput) =>
      apiPatch<{ data: LeadResponse; duplicates: DuplicateMatch[] }>(`/api/v1/leads/${leadId}`, values),
    onSuccess: (result) => {
      toast.success(`${result.data.firstName} was updated.`);
      void queryClient.invalidateQueries({ queryKey: [LEADS_QUERY_KEY_ROOT] });
      router.push(`/leads/${leadId}`);
    },
  });

  if (leadQuery.isLoading) {
    return (
      <div className="max-w-3xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (leadQuery.isError || !leadQuery.data) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Could not load this lead.</AlertDescription>
      </Alert>
    );
  }

  const lead = leadQuery.data.data;

  return (
    <div className="max-w-3xl space-y-6">
      <h2 className="h1">
        Edit {lead.firstName} {lead.lastName}
      </h2>
      <LeadForm
        mode="edit"
        lead={lead}
        onSubmit={(values) => mutation.mutateAsync(values)}
        submitLabel="Save changes"
        pendingLabel="Saving…"
        onCancel={() => router.push(`/leads/${leadId}`)}
      />
    </div>
  );
}
