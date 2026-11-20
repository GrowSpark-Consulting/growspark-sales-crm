"use client";

import Link from "next/link";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { OPEN_LEAD_STATUSES, type OpenLeadStatus } from "@growspark/shared";
import { apiPost, ApiError } from "@/lib/api-client";
import { LEADS_QUERY_KEY_ROOT, useLead, useLeadStatusHistory } from "@/hooks/use-leads";
import { useLeadSources } from "@/hooks/use-lead-sources";
import { useUserOptions } from "@/hooks/use-user-options";
import { RecordLayout } from "@/components/ui/record-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog";
import { formatDate, formatTime, formatPhoneForDisplay } from "@/lib/format";
import { leadStatusBadgeVariant, leadStatusLabel, priorityBadgeVariant, priorityLabel } from "@/lib/lead-presentation";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="label text-ink-muted">{label}</p>
      <p className="body">{value ?? <span className="text-ink-muted">—</span>}</p>
    </div>
  );
}

export function LeadDetailPageClient({ leadId }: { leadId: string }) {
  const queryClient = useQueryClient();
  const leadQuery = useLead(leadId);
  const historyQuery = useLeadStatusHistory(leadId);
  const { data: userOptions } = useUserOptions();
  const { data: sourcesData } = useLeadSources();

  async function archive() {
    await apiPost(`/api/v1/leads/${leadId}/archive`);
    toast.success("Lead archived.");
    void queryClient.invalidateQueries({ queryKey: [LEADS_QUERY_KEY_ROOT] });
  }

  async function restore() {
    await apiPost(`/api/v1/leads/${leadId}/restore`);
    toast.success("Lead restored.");
    void queryClient.invalidateQueries({ queryKey: [LEADS_QUERY_KEY_ROOT] });
  }

  async function changeStatus(status: OpenLeadStatus) {
    try {
      await apiPost(`/api/v1/leads/${leadId}/status`, { status });
      toast.success(`Status changed to ${leadStatusLabel(status)}.`);
      void queryClient.invalidateQueries({ queryKey: [LEADS_QUERY_KEY_ROOT] });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not change status. Please try again.");
    }
  }

  if (leadQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (leadQuery.isError || !leadQuery.data) {
    const notFound = leadQuery.error instanceof ApiError && leadQuery.error.status === 404;
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {notFound ? "This lead does not exist, or was deleted." : "Could not load this lead."}
        </AlertDescription>
      </Alert>
    );
  }

  const lead = leadQuery.data.data;
  const ownerName = userOptions?.data.find((u) => u.id === lead.ownerId)?.name;
  const sourceName = sourcesData?.data.find((s) => s.id === lead.sourceId)?.name;
  const fullName = `${lead.firstName} ${lead.lastName ?? ""}`.trim();
  // D29: CONVERTED is never offered as a manual target, and a lead that is
  // already CONVERTED (only reachable via the Day 3 convert action) offers
  // no status buttons at all — the API would refuse any change with 409.
  const availableStatuses = OPEN_LEAD_STATUSES.filter((status) => status !== lead.status);

  return (
    <RecordLayout
      title={fullName}
      statusBadge={
        <>
          <Badge variant={leadStatusBadgeVariant(lead.status)}>{leadStatusLabel(lead.status)}</Badge>
          {lead.archivedAt && <Badge variant="danger">Archived</Badge>}
        </>
      }
      actions={
        <>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/leads/${lead.id}/edit`}>
              <Pencil className="size-(--icon-md)" aria-hidden="true" />
              Edit
            </Link>
          </Button>
          {lead.archivedAt ? (
            <ConfirmActionDialog
              triggerLabel="Restore"
              title="Restore lead"
              description={`${fullName} will reappear in the active leads list.`}
              confirmLabel="Restore"
              onConfirm={restore}
            />
          ) : (
            <ConfirmActionDialog
              triggerLabel="Archive"
              title="Archive lead"
              description={`${fullName} will be hidden from the active leads list. You can restore it later.`}
              confirmLabel="Archive"
              destructive
              onConfirm={archive}
            />
          )}
        </>
      }
      keyFields={[
        { label: "Source", value: sourceName ?? "…" },
        { label: "Priority", value: <Badge variant={priorityBadgeVariant(lead.priority)}>{priorityLabel(lead.priority)}</Badge> },
        { label: "Owner", value: ownerName ?? "Unassigned" },
        { label: "Next follow-up", value: lead.nextFollowUpAt ? `${formatDate(lead.nextFollowUpAt)}, ${formatTime(lead.nextFollowUpAt)}` : null },
      ]}
      tabs={[
        {
          value: "overview",
          label: "Overview",
          content: (
            <div className="space-y-6">
              {lead.status !== "CONVERTED" && (
                <div>
                  <p className="label mb-2 text-ink-muted">Change status</p>
                  <div className="flex flex-wrap gap-2">
                    {availableStatuses.map((status) => (
                      <Button key={status} variant="outline" size="sm" onClick={() => changeStatus(status)}>
                        {leadStatusLabel(status)}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid gap-4 rounded-lg border border-line bg-surface p-4 sm:grid-cols-2">
                <Field label="Email" value={lead.email} />
                <Field label="Phone" value={formatPhoneForDisplay(lead.phone)} />
                <Field label="Company name" value={lead.companyName} />
                <Field
                  label="Website"
                  value={
                    lead.website ? (
                      <a href={lead.website} target="_blank" rel="noreferrer" className="text-primary underline">
                        {lead.website}
                      </a>
                    ) : null
                  }
                />
                <Field label="Job title" value={lead.jobTitle} />
                <Field label="Industry" value={lead.industry} />
                <Field label="Source detail" value={lead.sourceDetail} />
                <Field label="Purchase timeline" value={lead.purchaseTimeline} />
                <Field label="Estimated budget" value={lead.estimatedBudget ? `₹ ${lead.estimatedBudget}` : null} />
                <Field label="Created" value={formatDate(lead.createdAt)} />
                <div className="sm:col-span-2">
                  <Field label="Notes" value={lead.notes} />
                </div>
              </div>

              {/* Original enquiry — read-only after creation (2.3 brief, D35). */}
              <div>
                <p className="h2 mb-2">Original enquiry</p>
                <div className="grid gap-4 rounded-lg border border-line bg-surface-sunken p-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Field label="Requirement" value={lead.requirement} />
                  </div>
                  {lead.capturedFields != null && Object.keys(lead.capturedFields as object).length > 0 && (
                    <div className="sm:col-span-2">
                      <p className="label text-ink-muted">Other captured answers</p>
                      <dl className="mt-1 grid gap-1 sm:grid-cols-2">
                        {Object.entries(lead.capturedFields as Record<string, unknown>).map(([key, value]) => (
                          <div key={key} className="flex gap-2 text-sm">
                            <dt className="text-ink-muted">{key}:</dt>
                            <dd>{String(value)}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ),
        },
        {
          value: "history",
          label: "History",
          content: (
            <div className="rounded-lg border border-line bg-surface">
              {historyQuery.isLoading && <Skeleton className="h-24 w-full" />}
              {!historyQuery.isLoading && (historyQuery.data?.data.length ?? 0) === 0 && (
                <p className="p-4 text-ink-muted">No status changes yet.</p>
              )}
              {!historyQuery.isLoading && (historyQuery.data?.data.length ?? 0) > 0 && (
                <ul className="divide-y divide-line">
                  {historyQuery.data!.data.map((entry) => (
                    <li key={entry.id} className="flex items-center justify-between p-4 text-sm">
                      <span>
                        {entry.fromStatus ? (
                          <>
                            <Badge variant={leadStatusBadgeVariant(entry.fromStatus)}>
                              {leadStatusLabel(entry.fromStatus)}
                            </Badge>
                            {" → "}
                          </>
                        ) : null}
                        <Badge variant={leadStatusBadgeVariant(entry.toStatus)}>{leadStatusLabel(entry.toStatus)}</Badge>
                      </span>
                      <span className="text-ink-muted">
                        {formatDate(entry.createdAt)}, {formatTime(entry.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ),
        },
      ]}
    />
  );
}
