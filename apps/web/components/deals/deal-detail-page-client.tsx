"use client";

import Link from "next/link";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import type { LossReason } from "@growspark/shared";
import { apiPost, ApiError } from "@/lib/api-client";
import { DEALS_QUERY_KEY_ROOT, useDeal, useDealStageHistory } from "@/hooks/use-deals";
import { PIPELINE_QUERY_KEY_ROOT, usePipelineStages } from "@/hooks/use-pipeline";
import { useCompany } from "@/hooks/use-companies";
import { useUserOptions } from "@/hooks/use-user-options";
import { useLeadSources } from "@/hooks/use-lead-sources";
import { RecordLayout } from "@/components/ui/record-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog";
import { CloseLostDialog } from "@/components/deals/close-lost-dialog";
import { DealContactsTab } from "@/components/deals/deal-contacts-tab";
import { QuotationsTab } from "@/components/quotations/quotations-tab";
import { NextActivityField, RecordTimeline } from "@/components/activities/record-timeline";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDate, formatTime, formatINR } from "@/lib/format";
import { dealStatusBadgeVariant, dealStatusLabel } from "@/lib/deal-presentation";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="label text-ink-muted">{label}</p>
      <p className="body">{value ?? <span className="text-ink-muted">—</span>}</p>
    </div>
  );
}

export function DealDetailPageClient({ dealId }: { dealId: string }) {
  const queryClient = useQueryClient();
  const dealQuery = useDeal(dealId);
  const historyQuery = useDealStageHistory(dealId);
  const { data: stagesData } = usePipelineStages();
  const { data: userOptions } = useUserOptions();
  const { data: sourcesData } = useLeadSources({ includeInactive: true });
  const deal = dealQuery.data?.data;
  const companyQuery = useCompany(deal?.companyId);

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: [DEALS_QUERY_KEY_ROOT] });
    void queryClient.invalidateQueries({ queryKey: [PIPELINE_QUERY_KEY_ROOT] });
  }

  async function archive() {
    await apiPost(`/api/v1/deals/${dealId}/archive`);
    toast.success("Deal archived.");
    invalidate();
  }

  async function restore() {
    await apiPost(`/api/v1/deals/${dealId}/restore`);
    toast.success("Deal restored.");
    invalidate();
  }

  async function moveStage(stageId: string, stageName: string) {
    try {
      await apiPost(`/api/v1/deals/${dealId}/stage`, { stageId });
      toast.success(`Moved to ${stageName}.`);
      invalidate();
      void queryClient.invalidateQueries({ queryKey: [DEALS_QUERY_KEY_ROOT, "stage-history", dealId] });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not move this deal. Please try again.");
    }
  }

  async function closeWon() {
    await apiPost(`/api/v1/deals/${dealId}/close`, { status: "WON" });
    toast.success("Deal closed as Won.");
    invalidate();
  }

  async function closeLost(reason: LossReason, note?: string) {
    await apiPost(`/api/v1/deals/${dealId}/close`, { status: "LOST", lostReason: reason, lostNote: note });
    toast.success("Deal closed as Lost.");
    invalidate();
  }

  async function reopen() {
    await apiPost(`/api/v1/deals/${dealId}/reopen`);
    toast.success("Deal reopened.");
    invalidate();
  }

  if (dealQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (dealQuery.isError || !deal) {
    const notFound = dealQuery.error instanceof ApiError && dealQuery.error.status === 404;
    return (
      <Alert variant="destructive">
        <AlertDescription>{notFound ? "This deal does not exist, or was deleted." : "Could not load this deal."}</AlertDescription>
      </Alert>
    );
  }

  const stages = stagesData?.data ?? [];
  const stageNames = new Map(stages.map((stage) => [stage.id, stage.name]));
  const openStages = stages.filter((stage) => stage.type === "OPEN" && stage.id !== deal.stageId);
  const ownerName = userOptions?.data.find((user) => user.id === deal.ownerId)?.name;
  const sourceName = sourcesData?.data.find((source) => source.id === deal.sourceId)?.name;
  const closed = deal.status !== "OPEN";
  const weightedValue = (Number(deal.value) * deal.probability) / 100;

  return (
    <RecordLayout
      title={deal.name}
      statusBadge={
        <>
          <Badge variant={dealStatusBadgeVariant(deal.status)}>{dealStatusLabel(deal.status)}</Badge>
          {deal.archivedAt && <Badge variant="danger">Archived</Badge>}
        </>
      }
      actions={
        <>
          {!closed && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/deals/${deal.id}/edit`}>
                <Pencil className="size-(--icon-md)" aria-hidden="true" />
                Edit
              </Link>
            </Button>
          )}

          {!closed && openStages.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  Move stage
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {openStages.map((stage) => (
                  <DropdownMenuItem key={stage.id} onSelect={() => moveStage(stage.id, stage.name)}>
                    {stage.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {!closed && (
            <ConfirmActionDialog
              triggerLabel="Close as Won"
              title="Close deal as Won"
              description={`${deal.name} will be marked Won at 100% probability.`}
              confirmLabel="Close as Won"
              onConfirm={closeWon}
            />
          )}
          {!closed && <CloseLostDialog onConfirm={closeLost} />}

          {closed && (
            <ConfirmActionDialog
              triggerLabel="Reopen"
              title="Reopen deal"
              description={`${deal.name} will return to the pipeline's first open stage (${stages.find((s) => s.type === "OPEN")?.name ?? "the first open stage"}).`}
              confirmLabel="Reopen"
              onConfirm={reopen}
            />
          )}

          {deal.archivedAt ? (
            <ConfirmActionDialog
              triggerLabel="Restore"
              title="Restore deal"
              description={`${deal.name} will reappear in the active deals list.`}
              confirmLabel="Restore"
              onConfirm={restore}
            />
          ) : (
            <ConfirmActionDialog
              triggerLabel="Archive"
              title="Archive deal"
              description={`${deal.name} will be hidden from the active deals list. You can restore it later.`}
              confirmLabel="Archive"
              destructive
              onConfirm={archive}
            />
          )}
        </>
      }
      keyFields={[
        {
          label: "Company",
          value: (
            <Link href={`/companies/${deal.companyId}`} className="text-primary hover:underline">
              {companyQuery.data?.data.name ?? "…"}
            </Link>
          ),
        },
        { label: "Stage", value: stageNames.get(deal.stageId) ?? "—" },
        { label: "Value", value: formatINR(Number(deal.value)) },
        { label: "Probability", value: `${deal.probability}%` },
        { label: "Weighted value", value: formatINR(weightedValue) },
        { label: "Expected close", value: deal.expectedCloseDate ? formatDate(deal.expectedCloseDate) : null },
        { label: "Owner", value: ownerName ?? "Unassigned" },
        { label: "Next activity", value: <NextActivityField activity={deal.nextActivity} /> },
      ]}
      tabs={[
        {
          value: "overview",
          label: "Overview",
          content: (
            <div className="space-y-6">
              {closed && (
                <Alert>
                  <AlertDescription>
                    This deal is closed. Editing, moving stages, and changing contacts are disabled until it is reopened.
                  </AlertDescription>
                </Alert>
              )}
              <div className="grid gap-4 rounded-lg border border-line bg-surface p-4 sm:grid-cols-2">
                <Field label="Deal type" value={deal.dealType} />
                <Field label="Source" value={sourceName} />
                {closed && <Field label="Closed" value={deal.closedAt ? `${formatDate(deal.closedAt)}, ${formatTime(deal.closedAt)}` : null} />}
                {deal.status === "LOST" && <Field label="Lost reason" value={deal.lostReason} />}
                {deal.status === "LOST" && (
                  <div className="sm:col-span-2">
                    <Field label="Lost note" value={deal.lostNote} />
                  </div>
                )}
                <Field label="Created" value={formatDate(deal.createdAt)} />
              </div>
            </div>
          ),
        },
        {
          value: "contacts",
          label: "Contacts",
          content: <DealContactsTab deal={deal} />,
        },
        {
          value: "stage-history",
          label: "Stage history",
          content: (
            <div className="rounded-lg border border-line bg-surface">
              {historyQuery.isLoading && <Skeleton className="h-24 w-full" />}
              {!historyQuery.isLoading && (historyQuery.data?.data.length ?? 0) === 0 && (
                <p className="p-4 text-ink-muted">No stage moves yet.</p>
              )}
              {!historyQuery.isLoading && (historyQuery.data?.data.length ?? 0) > 0 && (
                <ul className="divide-y divide-line">
                  {historyQuery.data!.data.map((entry) => (
                    <li key={entry.id} className="flex items-center justify-between p-4 text-sm">
                      <span>
                        {entry.fromStageId ? (
                          <>
                            <span className="text-ink-muted">{stageNames.get(entry.fromStageId) ?? "—"}</span>
                            {" → "}
                          </>
                        ) : null}
                        <span className="body-strong">{stageNames.get(entry.toStageId) ?? "—"}</span>
                      </span>
                      <span className="text-ink-muted">
                        by {entry.changedByName} · {formatDate(entry.createdAt)}, {formatTime(entry.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ),
        },
        {
          value: "quotations",
          label: "Quotations",
          content: (
            <QuotationsTab
              dealId={deal.id}
              addHref={`/quotations/new?companyId=${deal.companyId}&dealId=${deal.id}`}
              emptyLabel="No quotations for this deal yet."
            />
          ),
        },
        { value: "timeline", label: "Timeline", content: <RecordTimeline owner="deals" recordId={deal.id} /> },
      ]}
    />
  );
}
