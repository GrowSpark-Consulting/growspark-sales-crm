"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { QUOTATION_STATUSES, formatRupees, type QuotationResponse, type QuotationStatus } from "@growspark/shared";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { SearchInput } from "@/components/ui/search-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuotationsList } from "@/hooks/use-quotations";
import { useUserOptions } from "@/hooks/use-user-options";
import { useListUrlState } from "@/hooks/use-list-url-state";
import { CompanyFilter } from "@/components/pickers/company-filter";
import { formatDate } from "@/lib/format";
import { quotationStatusBadgeVariant, quotationStatusLabel } from "@/lib/quotation-presentation";

const ANY = "ANY";

export function QuotationsPageClient() {
  const { searchParams, page, pageSize, setParams } = useListUrlState();

  const q = searchParams.get("q") ?? "";
  const status = (searchParams.get("status") as QuotationStatus | null) ?? undefined;
  const companyId = searchParams.get("companyId") ?? undefined;
  const ownerId = searchParams.get("ownerId") ?? undefined;
  const issuedFrom = searchParams.get("issuedFrom") ?? undefined;
  const issuedTo = searchParams.get("issuedTo") ?? undefined;
  const archived = searchParams.get("archived") === "true";
  const sortField = searchParams.get("sort")?.split(":")[0] ?? "createdAt";
  const sortDirection = (searchParams.get("sort")?.split(":")[1] as "asc" | "desc" | undefined) ?? "desc";

  const listQuery = useQuotationsList({
    page,
    pageSize,
    q: q || undefined,
    status,
    companyId,
    ownerId,
    issuedFrom,
    issuedTo,
    archived,
    sort: `${sortField}:${sortDirection}`,
  });
  const { data: userOptions } = useUserOptions();
  const owners = userOptions?.data ?? [];

  const columns: DataTableColumn<QuotationResponse>[] = [
    {
      key: "number",
      header: "Number",
      sortable: true,
      render: (quotation) => (
        <Link href={`/quotations/${quotation.id}`} className="body-strong gs-num text-ink hover:underline">
          {quotation.number}
        </Link>
      ),
    },
    {
      key: "company",
      header: "Company",
      render: (quotation) => (
        <Link href={`/companies/${quotation.companyId}`} className="text-ink-muted hover:underline">
          {quotation.companyName}
        </Link>
      ),
    },
    {
      key: "deal",
      header: "Deal",
      render: (quotation) =>
        quotation.dealId ? (
          <Link href={`/deals/${quotation.dealId}`} className="text-ink-muted hover:underline">
            {quotation.dealName}
          </Link>
        ) : (
          <span className="text-ink-muted">—</span>
        ),
    },
    {
      key: "issueDate",
      header: "Issued",
      sortable: true,
      render: (quotation) => <span className="gs-num text-ink-muted">{formatDate(quotation.issueDate)}</span>,
    },
    {
      key: "validUntil",
      header: "Valid until",
      sortable: true,
      render: (quotation) => <span className="gs-num text-ink-muted">{formatDate(quotation.validUntil)}</span>,
    },
    {
      key: "total",
      header: "Total",
      sortable: true,
      render: (quotation) => <span className="gs-num">{formatRupees(quotation.total)}</span>,
    },
    {
      key: "owner",
      header: "Owner",
      render: (quotation) => <span className="text-ink-muted">{quotation.ownerName ?? "—"}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (quotation) => (
        <Badge variant={quotationStatusBadgeVariant(quotation.status)}>{quotationStatusLabel(quotation.status)}</Badge>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button asChild>
          <Link href="/quotations/new">
            <Plus className="size-(--icon-md)" aria-hidden="true" />
            New quotation
          </Link>
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={listQuery.data?.data ?? []}
        rowKey={(quotation) => quotation.id}
        isLoading={listQuery.isLoading}
        isError={listQuery.isError}
        onRetry={() => listQuery.refetch()}
        sort={{ field: sortField, direction: sortDirection }}
        onSortChange={(field) => {
          const nextDirection = sortField === field && sortDirection === "asc" ? "desc" : "asc";
          setParams({ sort: `${field}:${nextDirection}` });
        }}
        page={page}
        pageSize={pageSize}
        total={listQuery.data?.meta.total ?? 0}
        onPageChange={(nextPage) => setParams({ page: nextPage })}
        emptyTitle={archived ? "No archived quotations" : "No quotations yet"}
        emptyDescription={archived ? "Quotations you archive will appear here." : "Create a quotation for a company and contact."}
        emptyAction={
          !archived && (
            <Button asChild size="sm">
              <Link href="/quotations/new">New quotation</Link>
            </Button>
          )
        }
        filterBar={
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput
              value={q}
              onValueChange={(value) => setParams({ q: value || undefined })}
              onSearch={(value) => setParams({ q: value || undefined })}
              placeholder="Search number or company"
              aria-label="Search quotations"
              className="w-60"
            />
            <Select value={status ?? ANY} onValueChange={(value) => setParams({ status: value === ANY ? undefined : value })}>
              <SelectTrigger className="w-36" aria-label="Filter by status">
                <SelectValue placeholder="Any status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any status</SelectItem>
                {QUOTATION_STATUSES.map((candidate) => (
                  <SelectItem key={candidate} value={candidate}>
                    {quotationStatusLabel(candidate)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <CompanyFilter companyId={companyId} onCompanyIdChange={(next) => setParams({ companyId: next })} />
            <Select value={ownerId ?? ANY} onValueChange={(value) => setParams({ ownerId: value === ANY ? undefined : value })}>
              <SelectTrigger className="w-40" aria-label="Filter by owner">
                <SelectValue placeholder="Any owner" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any owner</SelectItem>
                {owners.map((owner) => (
                  <SelectItem key={owner.id} value={owner.id}>
                    {owner.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <label className="flex items-center gap-1 text-sm text-ink-muted">
              Issued from
              <Input
                type="date"
                className="w-40"
                aria-label="Issued from"
                value={issuedFrom ?? ""}
                onChange={(event) => setParams({ issuedFrom: event.target.value || undefined })}
              />
            </label>
            <label className="flex items-center gap-1 text-sm text-ink-muted">
              to
              <Input
                type="date"
                className="w-40"
                aria-label="Issued to"
                value={issuedTo ?? ""}
                onChange={(event) => setParams({ issuedTo: event.target.value || undefined })}
              />
            </label>
            <Select value={archived ? "archived" : ANY} onValueChange={(value) => setParams({ archived: value === "archived" ? "true" : undefined })}>
              <SelectTrigger className="w-44" aria-label="Filter by archived status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Active quotations</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      />
    </div>
  );
}
