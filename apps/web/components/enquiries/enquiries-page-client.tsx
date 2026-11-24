"use client";

import Link from "next/link";
import { SUBMISSION_STATUSES, type EnquiryResponse, type SubmissionStatus } from "@growspark/shared";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useEnquiriesList } from "@/hooks/use-enquiries";
import { useListUrlState } from "@/hooks/use-list-url-state";
import { formatDate, formatTime } from "@/lib/format";
import { enquiryStatusBadgeVariant, enquiryStatusLabel } from "@/lib/enquiry-presentation";

const ANY = "ANY";

export function EnquiriesPageClient() {
  const { searchParams, page, pageSize, setParams } = useListUrlState();

  const status = searchParams.get("status") ?? undefined;
  const formType = searchParams.get("formType") ?? "";
  const archived = searchParams.get("archived") === "true";
  const receivedFrom = searchParams.get("receivedFrom") ?? "";
  const receivedTo = searchParams.get("receivedTo") ?? "";
  const sortField = searchParams.get("sort")?.split(":")[0] ?? "receivedAt";
  const sortDirection = (searchParams.get("sort")?.split(":")[1] as "asc" | "desc" | undefined) ?? "desc";

  const listQuery = useEnquiriesList({
    page,
    pageSize,
    status,
    formType: formType || undefined,
    archived,
    receivedFrom: receivedFrom ? new Date(receivedFrom).toISOString() : undefined,
    receivedTo: receivedTo ? new Date(receivedTo).toISOString() : undefined,
    sort: `${sortField}:${sortDirection}`,
  });

  const columns: DataTableColumn<EnquiryResponse>[] = [
    {
      key: "receivedAt",
      header: "Received",
      sortable: true,
      render: (enquiry) => (
        <Link href={`/enquiries/${enquiry.id}`} className="body-strong text-ink hover:underline">
          {formatDate(enquiry.receivedAt)} {formatTime(enquiry.receivedAt)}
        </Link>
      ),
    },
    {
      key: "formType",
      header: "Form",
      sortable: true,
      render: (enquiry) => <span className="text-ink-muted">{enquiry.formType}</span>,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (enquiry) => (
        <Badge variant={enquiryStatusBadgeVariant(enquiry.status)}>{enquiryStatusLabel(enquiry.status)}</Badge>
      ),
    },
    {
      key: "lead",
      header: "Lead",
      render: (enquiry) =>
        enquiry.leadId ? (
          <Link href={`/leads/${enquiry.leadId}`} className="text-ink hover:underline">
            View lead
          </Link>
        ) : (
          <span className="text-ink-muted">—</span>
        ),
    },
  ];

  return (
    <div className="space-y-4">
      <DataTable
        columns={columns}
        rows={listQuery.data?.data ?? []}
        rowKey={(enquiry) => enquiry.id}
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
        emptyTitle={archived ? "No archived enquiries" : "No enquiries yet"}
        emptyDescription={
          archived
            ? "Enquiries you archive will appear here."
            : "Website form submissions will appear here once the intake API receives one."
        }
        filterBar={
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={status ?? ANY}
              onValueChange={(value) => setParams({ status: value === ANY ? undefined : value })}
            >
              <SelectTrigger className="w-36" aria-label="Filter by status">
                <SelectValue placeholder="Any status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any status</SelectItem>
                {SUBMISSION_STATUSES.map((value: SubmissionStatus) => (
                  <SelectItem key={value} value={value}>
                    {enquiryStatusLabel(value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={formType}
              onChange={(event) => setParams({ formType: event.target.value || undefined })}
              placeholder="Form type"
              aria-label="Filter by form type"
              className="w-40"
            />
            <div className="flex items-center gap-1">
              <Input
                type="date"
                aria-label="Received from"
                value={receivedFrom}
                onChange={(event) => setParams({ receivedFrom: event.target.value || undefined })}
                className="w-36"
              />
              <span className="text-ink-muted">–</span>
              <Input
                type="date"
                aria-label="Received to"
                value={receivedTo}
                onChange={(event) => setParams({ receivedTo: event.target.value || undefined })}
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
                <SelectItem value={ANY}>Active enquiries</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      />
    </div>
  );
}
