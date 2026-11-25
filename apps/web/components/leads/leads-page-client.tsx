"use client";

import Link from "next/link";
import { Plus, Pencil, Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { LEAD_STATUSES, PRIORITIES, type LeadResponse, type LeadStatus, type Priority } from "@growspark/shared";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { SearchInput } from "@/components/ui/search-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog";
import { useLeadsList, LEADS_QUERY_KEY_ROOT } from "@/hooks/use-leads";
import { useLeadSources } from "@/hooks/use-lead-sources";
import { useUserOptions } from "@/hooks/use-user-options";
import { useListUrlState } from "@/hooks/use-list-url-state";
import { apiPost } from "@/lib/api-client";
import { buildExportHref } from "@/lib/export";
import { formatDate } from "@/lib/format";
import { leadStatusBadgeVariant, leadStatusLabel, priorityBadgeVariant, priorityLabel } from "@/lib/lead-presentation";

const ANY = "ANY";

export function LeadsPageClient() {
  const { searchParams, page, pageSize, setParams } = useListUrlState();
  const queryClient = useQueryClient();

  const q = searchParams.get("q") ?? "";
  const status = searchParams.get("status") ?? undefined;
  const sourceId = searchParams.get("sourceId") ?? undefined;
  const ownerId = searchParams.get("ownerId") ?? undefined;
  const priority = searchParams.get("priority") ?? undefined;
  const archived = searchParams.get("archived") === "true";
  const createdFrom = searchParams.get("createdFrom") ?? "";
  const createdTo = searchParams.get("createdTo") ?? "";
  const sortField = searchParams.get("sort")?.split(":")[0] ?? "createdAt";
  const sortDirection = (searchParams.get("sort")?.split(":")[1] as "asc" | "desc" | undefined) ?? "desc";

  const listQuery = useLeadsList({
    page,
    pageSize,
    q: q || undefined,
    status,
    sourceId,
    ownerId,
    priority,
    archived,
    createdFrom: createdFrom ? new Date(createdFrom).toISOString() : undefined,
    createdTo: createdTo ? new Date(createdTo).toISOString() : undefined,
    sort: `${sortField}:${sortDirection}`,
  });
  const { data: userOptions } = useUserOptions();
  const owners = userOptions?.data ?? [];
  const ownerNames = new Map(owners.map((u) => [u.id, u.name]));
  const { data: sourcesData } = useLeadSources({ includeInactive: true });
  const sources = sourcesData?.data ?? [];
  const sourceNames = new Map(sources.map((s) => [s.id, s.name]));

  const exportHref = buildExportHref("/api/v1/leads/export", {
    q: q || undefined,
    status,
    sourceId,
    ownerId,
    priority,
    archived,
    createdFrom: createdFrom ? new Date(createdFrom).toISOString() : undefined,
    createdTo: createdTo ? new Date(createdTo).toISOString() : undefined,
    sort: `${sortField}:${sortDirection}`,
  });

  async function archiveLead(lead: LeadResponse) {
    await apiPost(`/api/v1/leads/${lead.id}/archive`);
    toast.success(`${lead.firstName} was archived.`);
    void queryClient.invalidateQueries({ queryKey: [LEADS_QUERY_KEY_ROOT] });
  }

  async function restoreLead(lead: LeadResponse) {
    await apiPost(`/api/v1/leads/${lead.id}/restore`);
    toast.success(`${lead.firstName} was restored.`);
    void queryClient.invalidateQueries({ queryKey: [LEADS_QUERY_KEY_ROOT] });
  }

  const columns: DataTableColumn<LeadResponse>[] = [
    {
      key: "firstName",
      header: "Name",
      sortable: true,
      render: (lead) => (
        <Link href={`/leads/${lead.id}`} className="body-strong text-ink hover:underline">
          {lead.firstName} {lead.lastName}
        </Link>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (lead) => <Badge variant={leadStatusBadgeVariant(lead.status)}>{leadStatusLabel(lead.status)}</Badge>,
    },
    {
      key: "source",
      header: "Source",
      render: (lead) => <span className="text-ink-muted">{sourceNames.get(lead.sourceId) ?? "—"}</span>,
    },
    {
      key: "priority",
      header: "Priority",
      sortable: true,
      render: (lead) => <Badge variant={priorityBadgeVariant(lead.priority)}>{priorityLabel(lead.priority)}</Badge>,
    },
    {
      key: "owner",
      header: "Owner",
      render: (lead) => (
        <span className="text-ink-muted">{lead.ownerId ? (ownerNames.get(lead.ownerId) ?? "—") : "—"}</span>
      ),
    },
    {
      key: "createdAt",
      header: "Created",
      sortable: true,
      render: (lead) => <span className="gs-num text-ink-muted">{formatDate(lead.createdAt)}</span>,
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (lead) => (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="icon-sm" asChild aria-label={`Edit ${lead.firstName}`}>
            <Link href={`/leads/${lead.id}/edit`}>
              <Pencil className="size-4" aria-hidden="true" />
            </Link>
          </Button>
          {lead.archivedAt ? (
            <ConfirmActionDialog
              triggerLabel="Restore"
              title="Restore lead"
              description={`${lead.firstName} will reappear in the active leads list.`}
              confirmLabel="Restore"
              onConfirm={() => restoreLead(lead)}
            />
          ) : (
            <ConfirmActionDialog
              triggerLabel="Archive"
              title="Archive lead"
              description={`${lead.firstName} will be hidden from the active leads list. You can restore it later.`}
              confirmLabel="Archive"
              destructive
              onConfirm={() => archiveLead(lead)}
            />
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button asChild variant="outline">
          <a href={exportHref}>
            <Download className="size-(--icon-md)" aria-hidden="true" />
            Download CSV
          </a>
        </Button>
        <Button asChild variant="outline">
          <Link href="/leads/import">
            <Upload className="size-(--icon-md)" aria-hidden="true" />
            Import CSV
          </Link>
        </Button>
        <Button asChild>
          <Link href="/leads/new">
            <Plus className="size-(--icon-md)" aria-hidden="true" />
            Add lead
          </Link>
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={listQuery.data?.data ?? []}
        rowKey={(lead) => lead.id}
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
        emptyTitle={archived ? "No archived leads" : "No leads yet"}
        emptyDescription={
          archived ? "Leads you archive will appear here." : "Add your first lead to start the sales journey."
        }
        emptyAction={
          !archived && (
            <Button asChild size="sm">
              <Link href="/leads/new">Add lead</Link>
            </Button>
          )
        }
        filterBar={
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput
              value={q}
              onValueChange={(value) => setParams({ q: value || undefined })}
              onSearch={(value) => setParams({ q: value || undefined })}
              placeholder="Search name, email, phone or company"
              aria-label="Search leads"
              className="w-64"
            />
            <Select value={status ?? ANY} onValueChange={(value) => setParams({ status: value === ANY ? undefined : value })}>
              <SelectTrigger className="w-36" aria-label="Filter by status">
                <SelectValue placeholder="Any status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any status</SelectItem>
                {LEAD_STATUSES.map((value: LeadStatus) => (
                  <SelectItem key={value} value={value}>
                    {leadStatusLabel(value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={sourceId ?? ANY}
              onValueChange={(value) => setParams({ sourceId: value === ANY ? undefined : value })}
            >
              <SelectTrigger className="w-36" aria-label="Filter by source">
                <SelectValue placeholder="Any source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any source</SelectItem>
                {sources.map((source) => (
                  <SelectItem key={source.id} value={source.id}>
                    {source.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={priority ?? ANY}
              onValueChange={(value) => setParams({ priority: value === ANY ? undefined : value })}
            >
              <SelectTrigger className="w-32" aria-label="Filter by priority">
                <SelectValue placeholder="Any priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any priority</SelectItem>
                {PRIORITIES.map((value: Priority) => (
                  <SelectItem key={value} value={value}>
                    {priorityLabel(value)}
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
            <div className="flex items-center gap-1">
              <Input
                type="date"
                aria-label="Created from"
                value={createdFrom}
                onChange={(event) => setParams({ createdFrom: event.target.value || undefined })}
                className="w-36"
              />
              <span className="text-ink-muted">–</span>
              <Input
                type="date"
                aria-label="Created to"
                value={createdTo}
                onChange={(event) => setParams({ createdTo: event.target.value || undefined })}
                className="w-36"
              />
            </div>
            <Select
              value={archived ? "archived" : ANY}
              onValueChange={(value) => setParams({ archived: value === "archived" ? "true" : undefined })}
            >
              <SelectTrigger className="w-36" aria-label="Filter by archived status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Active leads</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      />
    </div>
  );
}
