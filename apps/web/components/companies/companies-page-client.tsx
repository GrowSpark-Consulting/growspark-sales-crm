"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { SearchInput } from "@/components/ui/search-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useCompaniesList } from "@/hooks/use-companies";
import { useUserOptions } from "@/hooks/use-user-options";
import { useListUrlState } from "@/hooks/use-list-url-state";
import { formatDate } from "@/lib/format";
import type { CompanyResponse } from "@growspark/shared";

const ANY = "ANY";

export function CompaniesPageClient() {
  const { searchParams, page, pageSize, setParams } = useListUrlState();

  const q = searchParams.get("q") ?? "";
  const archived = searchParams.get("archived") === "true";
  const ownerId = searchParams.get("ownerId") ?? undefined;
  const sortField = searchParams.get("sort")?.split(":")[0] ?? "createdAt";
  const sortDirection = (searchParams.get("sort")?.split(":")[1] as "asc" | "desc" | undefined) ?? "desc";

  const listQuery = useCompaniesList({
    page,
    pageSize,
    q: q || undefined,
    archived,
    ownerId,
    sort: `${sortField}:${sortDirection}`,
  });
  const { data: userOptions } = useUserOptions();
  const owners = userOptions?.data ?? [];
  const ownerNames = new Map(owners.map((u) => [u.id, u.name]));

  const columns: DataTableColumn<CompanyResponse>[] = [
    {
      key: "name",
      header: "Name",
      sortable: true,
      render: (company) => (
        <Link href={`/companies/${company.id}`} className="body-strong text-ink hover:underline">
          {company.name}
        </Link>
      ),
    },
    {
      key: "industry",
      header: "Industry",
      render: (company) => <span className="text-ink-muted">{company.industry ?? "—"}</span>,
    },
    {
      key: "phone",
      header: "Phone",
      render: (company) => <span className="text-ink-muted">{company.phone ?? "—"}</span>,
    },
    {
      key: "email",
      header: "Email",
      render: (company) => <span className="text-ink-muted">{company.email ?? "—"}</span>,
    },
    {
      key: "owner",
      header: "Owner",
      render: (company) => (
        <span className="text-ink-muted">{company.ownerId ? (ownerNames.get(company.ownerId) ?? "—") : "—"}</span>
      ),
    },
    {
      key: "createdAt",
      header: "Created",
      sortable: true,
      render: (company) => <span className="gs-num text-ink-muted">{formatDate(company.createdAt)}</span>,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button asChild>
          <Link href="/companies/new">
            <Plus className="size-(--icon-md)" aria-hidden="true" />
            Add company
          </Link>
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={listQuery.data?.data ?? []}
        rowKey={(company) => company.id}
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
        emptyTitle={archived ? "No archived companies" : "No companies yet"}
        emptyDescription={
          archived
            ? "Companies you archive will appear here."
            : "Add your first company to start tracking deals and contacts."
        }
        emptyAction={
          !archived && (
            <Button asChild size="sm">
              <Link href="/companies/new">Add company</Link>
            </Button>
          )
        }
        filterBar={
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput
              value={q}
              onValueChange={(value) => setParams({ q: value || undefined })}
              onSearch={(value) => setParams({ q: value || undefined })}
              placeholder="Search name, email or phone"
              aria-label="Search companies"
              className="w-64"
            />
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
              value={archived ? "archived" : ANY}
              onValueChange={(value) => setParams({ archived: value === "archived" ? "true" : undefined })}
            >
              <SelectTrigger className="w-40" aria-label="Filter by archived status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Active companies</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      />
    </div>
  );
}
