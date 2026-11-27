"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Download, Pencil } from "lucide-react";
import { QUOTATION_STATUS_TRANSITIONS, formatIndianDecimal, formatRupees, type QuotationResponse, type QuotationStatus } from "@growspark/shared";
import { apiPost, ApiError } from "@/lib/api-client";
import { QUOTATIONS_QUERY_KEY_ROOT, quotationPdfHref, useQuotation } from "@/hooks/use-quotations";
import { DEALS_QUERY_KEY_ROOT, useDeal } from "@/hooks/use-deals";
import { PIPELINE_QUERY_KEY_ROOT } from "@/hooks/use-pipeline";
import { RecordLayout } from "@/components/ui/record-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog";
import { StatusButtonGroup } from "@/components/ui/status-button-group";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { QuotationTotalsSummary } from "@/components/quotations/quotation-totals";
import { formatDate, formatTime } from "@/lib/format";
import { formatPercent, quotationStatusBadgeVariant, quotationStatusLabel } from "@/lib/quotation-presentation";

/**
 * Offered after a quotation is accepted, never forced (brief, D83): marking
 * the deal Won goes through the existing POST /deals/:id/close, exactly as
 * the deal page's own "Close as Won" does.
 */
function MarkDealWonDialog({
  open,
  onOpenChange,
  dealName,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealName: string;
  onConfirm: () => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setPending(true);
    setError(null);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update the deal. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark the deal as Won?</DialogTitle>
          <DialogDescription>
            This quotation was accepted. Do you also want to close the linked deal, {dealName}, as Won? You can do this later from the deal page.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Not now
          </Button>
          <Button onClick={confirm} disabled={pending}>
            {pending ? "Closing…" : "Mark deal as Won"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="label text-ink-muted">{label}</p>
      <p className="body">{value ?? <span className="text-ink-muted">—</span>}</p>
    </div>
  );
}

function LineItemsTable({ quotation }: { quotation: QuotationResponse }) {
  return (
    <div className="overflow-hidden rounded-lg border border-line">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">#</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead className="text-right">Unit price (₹)</TableHead>
            <TableHead className="text-right">Disc.</TableHead>
            <TableHead className="text-right">GST</TableHead>
            <TableHead className="text-right">Amount (₹)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(quotation.lineItems ?? []).map((item) => (
            <TableRow key={item.id}>
              <TableCell className="text-ink-muted">{item.position}</TableCell>
              <TableCell className="whitespace-pre-wrap">{item.description}</TableCell>
              <TableCell className="gs-num text-right">{formatPercent(item.quantity)}</TableCell>
              <TableCell className="gs-num text-right">{formatIndianDecimal(item.unitPrice)}</TableCell>
              <TableCell className="gs-num text-right">{item.discountPercent === "0.00" ? "—" : `${formatPercent(item.discountPercent)}%`}</TableCell>
              <TableCell className="gs-num text-right">{formatPercent(item.gstPercent)}%</TableCell>
              <TableCell className="gs-num text-right">{formatIndianDecimal(item.lineTotal)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

type QuotationStatusOption = {
  label: string;
  statusLabel: string;
  variant?: "destructive";
  confirm: { title: string; description: string; confirmLabel: string; destructive?: boolean };
};

/** How each status the user can request is labelled and confirmed (texts unchanged from before D105). */
function quotationActionOption(quotation: QuotationResponse, next: QuotationStatus): QuotationStatusOption {
  if (next === "SENT") {
    return {
      label: "Mark as sent",
      statusLabel: "Sent",
      confirm: {
        title: "Mark quotation as sent",
        description: `${quotation.number} will be marked Sent and can no longer be edited. It expires automatically after ${formatDate(quotation.validUntil)}.`,
        confirmLabel: "Mark as sent",
      },
    };
  }
  if (next === "ACCEPTED") {
    return {
      label: "Accepted",
      statusLabel: "Accepted",
      confirm: { title: "Mark quotation as accepted", description: `The customer accepted ${quotation.number}. This is final.`, confirmLabel: "Mark accepted" },
    };
  }
  return {
    label: "Rejected",
    statusLabel: "Rejected",
    confirm: {
      title: "Mark quotation as rejected",
      description: `The customer rejected ${quotation.number}. This is final; you can duplicate it to send a revised quotation.`,
      confirmLabel: "Mark rejected",
      destructive: true,
    },
  };
}

export function QuotationDetailPageClient({ quotationId }: { quotationId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const quotationQuery = useQuotation(quotationId);
  const quotation = quotationQuery.data?.data;
  const dealQuery = useDeal(quotation?.dealId ?? undefined);
  const [wonPromptOpen, setWonPromptOpen] = useState(false);

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: [QUOTATIONS_QUERY_KEY_ROOT] });
  }

  async function changeStatus(status: "SENT" | "ACCEPTED" | "REJECTED") {
    // The status group shows the success toast ("Status changed to …") and any error.
    const result = await apiPost<{ data: QuotationResponse }>(`/api/v1/quotations/${quotationId}/status`, { status });
    invalidate();
    if (status === "ACCEPTED" && result.data.dealId && dealQuery.data?.data.status === "OPEN") {
      setWonPromptOpen(true);
    }
  }

  async function markDealWon() {
    if (!quotation?.dealId) return;
    await apiPost(`/api/v1/deals/${quotation.dealId}/close`, { status: "WON" });
    toast.success(`${quotation.dealName ?? "The deal"} closed as Won.`);
    void queryClient.invalidateQueries({ queryKey: [DEALS_QUERY_KEY_ROOT] });
    void queryClient.invalidateQueries({ queryKey: [PIPELINE_QUERY_KEY_ROOT] });
  }

  async function duplicate() {
    const result = await apiPost<{ data: QuotationResponse }>(`/api/v1/quotations/${quotationId}/duplicate`);
    toast.success(`Draft ${result.data.number} created from ${quotation?.number}.`);
    invalidate();
    router.push(`/quotations/${result.data.id}`);
  }

  async function archive() {
    await apiPost(`/api/v1/quotations/${quotationId}/archive`);
    toast.success("Quotation archived.");
    invalidate();
  }

  async function restore() {
    await apiPost(`/api/v1/quotations/${quotationId}/restore`);
    toast.success("Quotation restored.");
    invalidate();
  }

  if (quotationQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (quotationQuery.isError || !quotation) {
    const notFound = quotationQuery.error instanceof ApiError && quotationQuery.error.status === 404;
    return (
      <Alert variant="destructive">
        <AlertDescription>{notFound ? "This quotation does not exist." : "Could not load this quotation."}</AlertDescription>
      </Alert>
    );
  }

  const archived = Boolean(quotation.archivedAt);
  // The current status is the selected button; the others are exactly the
  // transitions the shared rule allows from it (nothing else is offered).
  const statusOptions = [
    { value: quotation.status, label: quotationStatusLabel(quotation.status) },
    ...QUOTATION_STATUS_TRANSITIONS[quotation.status].map((next) => ({
      value: next,
      ...quotationActionOption(quotation, next),
    })),
  ];
  const dealStillOpen = quotation.status === "ACCEPTED" && Boolean(quotation.dealId) && dealQuery.data?.data.status === "OPEN";

  return (
    <>
      <RecordLayout
        title={quotation.number}
        statusBadge={
          <>
            <Badge variant={quotationStatusBadgeVariant(quotation.status)}>{quotationStatusLabel(quotation.status)}</Badge>
            {archived && <Badge variant="danger">Archived</Badge>}
          </>
        }
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <a href={quotationPdfHref(quotation.id)}>
                <Download className="size-(--icon-md)" aria-hidden="true" />
                Download PDF
              </a>
            </Button>
            {quotation.status === "DRAFT" && !archived && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/quotations/${quotation.id}/edit`}>
                  <Pencil className="size-(--icon-md)" aria-hidden="true" />
                  Edit
                </Link>
              </Button>
            )}
            {statusOptions.length > 1 && !archived && (
              <StatusButtonGroup
                groupLabel="Change status"
                options={statusOptions}
                current={quotation.status}
                onSelect={(status) => changeStatus(status as "SENT" | "ACCEPTED" | "REJECTED")}
                errorMessage="Could not change status. Please try again."
              />
            )}
            <ConfirmActionDialog
              triggerLabel="Duplicate"
              title="Duplicate quotation"
              description={`A new draft will be created with a new number and today's date, copying ${quotation.number}'s company, contact, deal, line items (with their discounts and GST rates), tax setting, terms and notes.`}
              confirmLabel="Duplicate"
              onConfirm={duplicate}
            />
            {archived ? (
              <ConfirmActionDialog
                triggerLabel="Restore"
                title="Restore quotation"
                description={`${quotation.number} will reappear in the active quotations list.`}
                confirmLabel="Restore"
                onConfirm={restore}
              />
            ) : (
              <ConfirmActionDialog
                triggerLabel="Archive"
                title="Archive quotation"
                description={`${quotation.number} will be hidden from the active quotations list. You can restore it later.`}
                confirmLabel="Archive"
                destructive
                onConfirm={archive}
              />
            )}
          </>
        }
        keyFields={[
          { label: "Company", value: <Link href={`/companies/${quotation.companyId}`} className="text-primary hover:underline">{quotation.companyName}</Link> },
          { label: "Contact", value: <Link href={`/contacts/${quotation.contactId}`} className="text-primary hover:underline">{quotation.contactName}</Link> },
          {
            label: "Deal",
            value: quotation.dealId ? <Link href={`/deals/${quotation.dealId}`} className="text-primary hover:underline">{quotation.dealName}</Link> : "—",
          },
          { label: "Issued", value: formatDate(quotation.issueDate) },
          { label: "Valid until", value: formatDate(quotation.validUntil) },
          { label: "Total", value: <span className="gs-num">{formatRupees(quotation.total)}</span> },
          { label: "Owner", value: quotation.ownerName ?? "Unassigned" },
          { label: "PDF reference", value: <span className="gs-num">{quotation.pdfReference}</span> },
        ]}
        tabs={[
          {
            value: "overview",
            label: "Overview",
            content: (
              <div className="space-y-6">
                {dealStillOpen && (
                  <Alert>
                    <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
                      <span>This quotation was accepted, but the linked deal {quotation.dealName} is still open.</span>
                      <Button size="sm" onClick={() => setWonPromptOpen(true)}>
                        Mark deal as Won
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}
                {quotation.status === "EXPIRED" && (
                  <Alert>
                    <AlertDescription>This quotation expired after {formatDate(quotation.validUntil)}. Duplicate it to send a fresh one.</AlertDescription>
                  </Alert>
                )}
                <LineItemsTable quotation={quotation} />
                <QuotationTotalsSummary
                  totals={{ subtotal: quotation.subtotal, gstBreakdown: quotation.gstBreakdown ?? [], total: quotation.total }}
                  pricesIncludeTax={quotation.pricesIncludeTax}
                />
                <div className="grid gap-4 rounded-lg border border-line bg-surface p-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Field label="Terms" value={quotation.terms ? <span className="whitespace-pre-wrap">{quotation.terms}</span> : null} />
                  </div>
                  <div className="sm:col-span-2">
                    <Field label="Notes" value={quotation.notes ? <span className="whitespace-pre-wrap">{quotation.notes}</span> : null} />
                  </div>
                  <Field label="Sent" value={quotation.sentAt ? `${formatDate(quotation.sentAt)}, ${formatTime(quotation.sentAt)}` : null} />
                  <Field label="Version" value={quotation.version} />
                  <Field label="Created" value={formatDate(quotation.createdAt)} />
                  <Field label="Last updated" value={`${formatDate(quotation.updatedAt)}, ${formatTime(quotation.updatedAt)}`} />
                </div>
              </div>
            ),
          },
        ]}
      />
      {quotation.dealId && (
        <MarkDealWonDialog open={wonPromptOpen} onOpenChange={setWonPromptOpen} dealName={quotation.dealName ?? "this deal"} onConfirm={markDealWon} />
      )}
    </>
  );
}
