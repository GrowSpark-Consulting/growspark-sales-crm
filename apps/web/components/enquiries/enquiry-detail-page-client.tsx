"use client";

import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiPost, ApiError } from "@/lib/api-client";
import { ENQUIRIES_QUERY_KEY_ROOT, useEnquiry } from "@/hooks/use-enquiries";
import { RecordLayout } from "@/components/ui/record-layout";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog";
import { formatDate, formatTime } from "@/lib/format";
import { enquiryStatusBadgeVariant, enquiryStatusLabel } from "@/lib/enquiry-presentation";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="label text-ink-muted">{label}</p>
      <p className="body">{value ?? <span className="text-ink-muted">—</span>}</p>
    </div>
  );
}

export function EnquiryDetailPageClient({ enquiryId }: { enquiryId: string }) {
  const queryClient = useQueryClient();
  const enquiryQuery = useEnquiry(enquiryId);

  async function markSpam() {
    await apiPost(`/api/v1/enquiries/${enquiryId}/mark-spam`);
    toast.success("Enquiry marked as spam. Its linked lead, if any, was archived.");
    void queryClient.invalidateQueries({ queryKey: [ENQUIRIES_QUERY_KEY_ROOT] });
  }

  async function archive() {
    await apiPost(`/api/v1/enquiries/${enquiryId}/archive`);
    toast.success("Enquiry archived.");
    void queryClient.invalidateQueries({ queryKey: [ENQUIRIES_QUERY_KEY_ROOT] });
  }

  async function restore() {
    await apiPost(`/api/v1/enquiries/${enquiryId}/restore`);
    toast.success("Enquiry restored.");
    void queryClient.invalidateQueries({ queryKey: [ENQUIRIES_QUERY_KEY_ROOT] });
  }

  if (enquiryQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (enquiryQuery.isError || !enquiryQuery.data) {
    const notFound = enquiryQuery.error instanceof ApiError && enquiryQuery.error.status === 404;
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {notFound ? "This enquiry does not exist, or was deleted." : "Could not load this enquiry."}
        </AlertDescription>
      </Alert>
    );
  }

  const enquiry = enquiryQuery.data.data;

  return (
    <RecordLayout
      title={enquiry.formType}
      statusBadge={
        <div className="flex items-center gap-2">
          <Badge variant={enquiryStatusBadgeVariant(enquiry.status)}>{enquiryStatusLabel(enquiry.status)}</Badge>
          {enquiry.archivedAt && <Badge variant="danger">Archived</Badge>}
        </div>
      }
      actions={
        <>
          {enquiry.status !== "SPAM" && (
            <ConfirmActionDialog
              triggerLabel="Mark as spam"
              title="Mark enquiry as spam"
              description="This enquiry will be marked as spam. If it created a Lead, that Lead will be archived too."
              confirmLabel="Mark as spam"
              destructive
              onConfirm={markSpam}
            />
          )}
          {enquiry.archivedAt ? (
            <ConfirmActionDialog
              triggerLabel="Restore"
              title="Restore enquiry"
              description="This enquiry will reappear in the active enquiries list."
              confirmLabel="Restore"
              onConfirm={restore}
            />
          ) : (
            <ConfirmActionDialog
              triggerLabel="Archive"
              title="Archive enquiry"
              description="This enquiry will be hidden from the active enquiries list. You can restore it later."
              confirmLabel="Archive"
              destructive
              onConfirm={archive}
            />
          )}
        </>
      }
      keyFields={[
        { label: "Form type", value: enquiry.formType },
        { label: "Received", value: `${formatDate(enquiry.receivedAt)} ${formatTime(enquiry.receivedAt)}` },
        {
          label: "Submitted",
          value: enquiry.submittedAt ? `${formatDate(enquiry.submittedAt)} ${formatTime(enquiry.submittedAt)}` : null,
        },
        { label: "Source page", value: enquiry.sourcePage },
        {
          label: "Lead",
          value: enquiry.lead ? (
            <Link href={`/leads/${enquiry.lead.id}`} className="text-ink hover:underline">
              {enquiry.lead.firstName} {enquiry.lead.lastName}
              {enquiry.lead.archivedAt ? " (archived)" : ""}
            </Link>
          ) : null,
        },
      ]}
      tabs={[
        {
          value: "overview",
          label: "Overview",
          content: (
            <div className="grid grid-cols-2 gap-4 rounded-lg border border-line bg-surface p-4 md:grid-cols-3">
              <Field label="External ID" value={enquiry.externalId} />
              <Field label="Submission ID" value={enquiry.id} />
              {enquiry.error && <Field label="Error" value={enquiry.error} />}
              {enquiry.lead && (
                <>
                  <Field label="Email" value={enquiry.lead.email} />
                  <Field label="Phone" value={enquiry.lead.phone} />
                  <Field label="Company" value={enquiry.lead.companyName} />
                  <Field label="Lead status" value={enquiry.lead.status} />
                </>
              )}
            </div>
          ),
        },
        {
          value: "payload",
          label: "Raw payload",
          content: (
            <pre className="overflow-x-auto rounded-lg border border-line bg-surface-sunken p-4 text-xs text-ink">
              {JSON.stringify(enquiry.payload, null, 2)}
            </pre>
          ),
        },
      ]}
    />
  );
}
