"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useDealsList } from "@/hooks/use-deals";
import { usePipelineStages } from "@/hooks/use-pipeline";
import { formatINR } from "@/lib/format";
import { dealStatusBadgeVariant, dealStatusLabel } from "@/lib/deal-presentation";

/**
 * Package 3.5: Company and Contact detail pages each gain a Deals tab,
 * reusing the companyId/contactId filters on GET /deals (the contactId one
 * added in 3.3, D48, specifically for this). A bounded, unpaginated list —
 * same spirit as CompanyContactsTab (2.5, D38) — not the full DataTable, since
 * what's realistically a handful of deals per record doesn't need search/
 * sort/paging of its own; the full /deals list already covers that case.
 */
export function DealsTab({
  companyId,
  contactId,
  addHref,
  emptyLabel,
}: {
  companyId?: string;
  contactId?: string;
  /** Company's tab only, per the brief — Contact's tab is read-only here. */
  addHref?: string;
  emptyLabel: string;
}) {
  const dealsQuery = useDealsList({ companyId, contactId, pageSize: 50, sort: "createdAt:desc" });
  const { data: stagesData } = usePipelineStages();
  const stageNames = new Map((stagesData?.data ?? []).map((stage) => [stage.id, stage.name]));

  return (
    <div className="space-y-4">
      {addHref && (
        <div className="flex justify-end">
          <Button size="sm" asChild>
            <Link href={addHref}>
              <Plus className="size-(--icon-md)" aria-hidden="true" />
              Add deal
            </Link>
          </Button>
        </div>
      )}

      {dealsQuery.isLoading && <Skeleton className="h-32 w-full" />}

      {dealsQuery.isError && (
        <Alert variant="destructive">
          <AlertDescription>Could not load deals.</AlertDescription>
        </Alert>
      )}

      {!dealsQuery.isLoading && !dealsQuery.isError && (dealsQuery.data?.data.length ?? 0) === 0 && (
        <p className="text-ink-muted">{emptyLabel}</p>
      )}

      {!dealsQuery.isLoading && !dealsQuery.isError && (dealsQuery.data?.data.length ?? 0) > 0 && (
        <div className="overflow-hidden rounded-lg border border-line">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Deal name</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dealsQuery.data!.data.map((deal) => (
                <TableRow key={deal.id}>
                  <TableCell>
                    <Link href={`/deals/${deal.id}`} className="body-strong text-ink hover:underline">
                      {deal.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-ink-muted">{stageNames.get(deal.stageId) ?? "—"}</TableCell>
                  <TableCell className="gs-num">{formatINR(Number(deal.value))}</TableCell>
                  <TableCell>
                    <Badge variant={dealStatusBadgeVariant(deal.status)}>{dealStatusLabel(deal.status)}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
