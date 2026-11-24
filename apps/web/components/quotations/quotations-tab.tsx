"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { formatRupees } from "@growspark/shared";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useQuotationsList } from "@/hooks/use-quotations";
import { formatDate } from "@/lib/format";
import { quotationStatusBadgeVariant, quotationStatusLabel } from "@/lib/quotation-presentation";

/**
 * Quotations on a Deal or Company page — the same bounded, unpaginated
 * shape as DealsTab (D50): a handful of rows per record, with the full
 * /quotations list covering search/sort/paging.
 */
export function QuotationsTab({
  companyId,
  dealId,
  addHref,
  emptyLabel,
}: {
  companyId?: string;
  dealId?: string;
  addHref?: string;
  emptyLabel: string;
}) {
  const query = useQuotationsList({ companyId, dealId, pageSize: 50, sort: "createdAt:desc" });
  const rows = query.data?.data ?? [];

  return (
    <div className="space-y-4">
      {addHref && (
        <div className="flex justify-end">
          <Button size="sm" asChild>
            <Link href={addHref}>
              <Plus className="size-(--icon-md)" aria-hidden="true" />
              New quotation
            </Link>
          </Button>
        </div>
      )}

      {query.isLoading && <Skeleton className="h-32 w-full" />}

      {query.isError && (
        <Alert variant="destructive">
          <AlertDescription>Could not load quotations.</AlertDescription>
        </Alert>
      )}

      {!query.isLoading && !query.isError && rows.length === 0 && <p className="text-ink-muted">{emptyLabel}</p>}

      {!query.isLoading && !query.isError && rows.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-line">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead>Valid until</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((quotation) => (
                <TableRow key={quotation.id}>
                  <TableCell>
                    <Link href={`/quotations/${quotation.id}`} className="body-strong gs-num text-ink hover:underline">
                      {quotation.number}
                    </Link>
                  </TableCell>
                  <TableCell className="gs-num text-ink-muted">{formatDate(quotation.issueDate)}</TableCell>
                  <TableCell className="gs-num text-ink-muted">{formatDate(quotation.validUntil)}</TableCell>
                  <TableCell className="gs-num">{formatRupees(quotation.total)}</TableCell>
                  <TableCell>
                    <Badge variant={quotationStatusBadgeVariant(quotation.status)}>{quotationStatusLabel(quotation.status)}</Badge>
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
