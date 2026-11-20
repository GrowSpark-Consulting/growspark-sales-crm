"use client";

import Link from "next/link";
import { Plus, LayoutGrid, List as ListIcon } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { SearchInput } from "@/components/ui/search-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PipelineBoard } from "@/components/deals/pipeline-board";
import { useDealsList } from "@/hooks/use-deals";
import { usePipelineStages } from "@/hooks/use-pipeline";
import { useUserOptions } from "@/hooks/use-user-options";
import { useCompaniesList } from "@/hooks/use-companies";
import { useListUrlState } from "@/hooks/use-list-url-state";
import { formatDate, formatINR } from "@/lib/format";
import { dealStatusBadgeVariant, dealStatusLabel } from "@/lib/deal-presentation";
import type { DealResponse, DealStatus } from "@growspark/shared";

const ANY = "ANY";
const DEAL_STATUSES: DealStatus[] = ["OPEN", "WON", "LOST"];

export function DealsPageClient() {
  const { searchParams, page, pageSize, setParams } = useListUrlState();
  const view = searchParams.get("view") === "board" ? "board" : "list";

  const q = searchParams.get("q") ?? "";
  const status = (searchParams.get("status") as DealStatus | null) ?? undefined;
  const stageId = searchParams.get("stageId") ?? undefined;
  const companyId = searchParams.get("companyId") ?? undefined;
  const ownerId = searchParams.get("ownerId") ?? undefined;
  const archived = searchParams.get("archived") === "true";
  const sortField = searchParams.get("sort")?.split(":")[0] ?? "createdAt";
  const sortDirection = (searchParams.get("sort")?.split(":")[1] as "asc" | "desc" | undefined) ?? "desc";

  const listQuery = useDealsList({
    page,
    pageSize,
    q: q || undefined,
    status,
    stageId,
    companyId,
    ownerId,
    archived,
    sort: `${sortField}:${sortDirection}`,
  });
  const { data: stagesData } = usePipelineStages();
  const stages = stagesData?.data ?? [];
  const stageNames = new Map(stages.map((stage) => [stage.id, stage.name]));
  const { data: userOptions } = useUserOptions();
  const owners = userOptions?.data ?? [];
  const ownerNames = new Map(owners.map((owner) => [owner.id, owner.name]));
  // Company filter reuses the plain companies list (no dedicated "deal
  // companies" lookup) — same pattern as the owner filter on every other
  // list page: a plain Select, not the form-only CompanySelect combobox.
  const { data: companiesData } = useCompaniesList({ pageSize: 100, sort: "name:asc" });
  const companies = companiesData?.data ?? [];
  const companyNames = new Map(companies.map((company) => [company.id, company.name]));

  const columns: DataTableColumn<DealResponse>[] = [
    {
      key: "name",
      header: "Deal name",
      sortable: true,
      render: (deal) => (
        <Link href={`/deals/${deal.id}`} className="body-strong text-ink hover:underline">
          {deal.name}
        </Link>
      ),
    },
    {
      key: "company",
      header: "Company",
      render: (deal) => (
        <Link href={`/companies/${deal.companyId}`} className="text-ink-muted hover:underline">
          {companyNames.get(deal.companyId) ?? "—"}
        </Link>
      ),
    },
    {
      key: "stage",
      header: "Stage",
      render: (deal) => <span className="text-ink-muted">{stageNames.get(deal.stageId) ?? "—"}</span>,
    },
    {
      key: "value",
      header: "Value",
      sortable: true,
      render: (deal) => <span className="gs-num">{formatINR(Number(deal.value))}</span>,
    },
    {
      key: "probability",
      header: "Probability",
      sortable: true,
      render: (deal) => <span className="gs-num text-ink-muted">{deal.probability}%</span>,
    },
    {
      key: "expectedCloseDate",
      header: "Expected close",
      sortable: true,
      render: (deal) => <span className="gs-num text-ink-muted">{deal.expectedCloseDate ? formatDate(deal.expectedCloseDate) : "—"}</span>,
    },
    {
      key: "owner",
      header: "Owner",
      render: (deal) => (
        <span className="text-ink-muted">{deal.ownerId ? (ownerNames.get(deal.ownerId) ?? "—") : "—"}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (deal) => <Badge variant={dealStatusBadgeVariant(deal.status)}>{dealStatusLabel(deal.status)}</Badge>,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="inline-flex rounded-md border border-line-strong p-0.5" role="group" aria-label="Deals view">
          <Button
            type="button"
            variant={view === "list" ? "default" : "ghost"}
            size="sm"
            aria-pressed={view === "list"}
            onClick={() => setParams({ view: undefined })}
          >
            <ListIcon className="size-4" aria-hidden="true" />
            List
          </Button>
          <Button
            type="button"
            variant={view === "board" ? "default" : "ghost"}
            size="sm"
            aria-pressed={view === "board"}
            onClick={() => setParams({ view: "board" })}
          >
            <LayoutGrid className="size-4" aria-hidden="true" />
            Board
          </Button>
        </div>
        <Button asChild>
          <Link href="/deals/new">
            <Plus className="size-(--icon-md)" aria-hidden="true" />
            Add deal
          </Link>
        </Button>
      </div>

      {view === "board" ? (
        <PipelineBoard />
      ) : (
      <DataTable
        columns={columns}
        rows={listQuery.data?.data ?? []}
        rowKey={(deal) => deal.id}
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
        emptyTitle={archived ? "No archived deals" : "No deals yet"}
        emptyDescription={
          archived ? "Deals you archive will appear here." : "Add your first deal to start tracking the pipeline."
        }
        emptyAction={
          !archived && (
            <Button asChild size="sm">
              <Link href="/deals/new">Add deal</Link>
            </Button>
          )
        }
        filterBar={
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput
              value={q}
              onValueChange={(value) => setParams({ q: value || undefined })}
              onSearch={(value) => setParams({ q: value || undefined })}
              placeholder="Search deal name"
              aria-label="Search deals"
              className="w-56"
            />
            <Select
              value={stageId ?? ANY}
              onValueChange={(value) => setParams({ stageId: value === ANY ? undefined : value })}
            >
              <SelectTrigger className="w-40" aria-label="Filter by stage">
                <SelectValue placeholder="Any stage" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any stage</SelectItem>
                {stages.map((stage) => (
                  <SelectItem key={stage.id} value={stage.id}>
                    {stage.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={status ?? ANY}
              onValueChange={(value) => setParams({ status: value === ANY ? undefined : value })}
            >
              <SelectTrigger className="w-36" aria-label="Filter by status">
                <SelectValue placeholder="Any status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any status</SelectItem>
                {DEAL_STATUSES.map((candidate) => (
                  <SelectItem key={candidate} value={candidate}>
                    {dealStatusLabel(candidate)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={ownerId ?? ANY}
              onValueChange={(value) => setParams({ ownerId: value === ANY ? undefined : value })}
            >
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
            <Select
              value={companyId ?? ANY}
              onValueChange={(value) => setParams({ companyId: value === ANY ? undefined : value })}
            >
              <SelectTrigger className="w-44" aria-label="Filter by company">
                <SelectValue placeholder="Any company" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any company</SelectItem>
                {companies.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={archived ? "archived" : ANY}
              onValueChange={(value) => setParams({ archived: value === "archived" ? "true" : undefined })}
            >
              <SelectTrigger className="w-40" aria-label="Filter by archived status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Active deals</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      />
      )}
    </div>
  );
}
