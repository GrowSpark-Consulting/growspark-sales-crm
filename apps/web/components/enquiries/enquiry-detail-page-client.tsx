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
import { StatusButtonGroup } from "@/components/ui/status-button-group";
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
    // The status group shows the success toast and any error.
    await apiPost(`/api/v1/enquiries/${enquiryId}/mark-spam`);
    void queryClient.invalidateQueries({ queryKey: [ENQUIRIES_QUERY_KEY_ROOT] });
  }

  async function archive() {
    await apiPost(`/api/v1/enquiries/${enquiryId}/archive`);
    toast.success("Submission archived.");
    void queryClient.invalidateQueries({ queryKey: [ENQUIRIES_QUERY_KEY_ROOT] });
  }

  async function restore() {
    await apiPost(`/api/v1/enquiries/${enquiryId}/restore`);
    toast.success("Submission restored.");
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
          {notFound ? "This submission does not exist, or was deleted." : "Could not load this submission."}
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
            <StatusButtonGroup
              groupLabel="Change status"
              options={[
                {
                  value: "SPAM",
                  label: "Mark as spam",
                  statusLabel: "Spam",
                  confirm: {
                    title: "Mark submission as spam",
                    description: "This submission will be marked as spam. If it created a Lead, that Lead will be archived too.",
                    confirmLabel: "Mark as spam",
                    destructive: true,
                  },
                },
              ]}
              onSelect={() => markSpam()}
              successMessage={() => "Status changed to Spam. Its linked lead, if any, was archived."}
              errorMessage="Could not mark this submission as spam. Please try again."
            />
          )}
          {enquiry.archivedAt ? (
            <ConfirmActionDialog
              triggerLabel="Restore"
              title="Restore submission"
              description="This submission will reappear in the active form submissions list."
              confirmLabel="Restore"
              onConfirm={restore}
            />
          ) : (
            <ConfirmActionDialog
              triggerLabel="Archive"
              title="Archive submission"
              description="This submission will be hidden from the active form submissions list. You can restore it later."
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
