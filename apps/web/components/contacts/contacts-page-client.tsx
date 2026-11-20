"use client";

import Link from "next/link";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { SearchInput } from "@/components/ui/search-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog";
import { ContactFormDialog } from "@/components/contacts/contact-form-dialog";
import { useContactsList, CONTACTS_QUERY_KEY_ROOT } from "@/hooks/use-contacts";
import { useUserOptions } from "@/hooks/use-user-options";
import { useListUrlState } from "@/hooks/use-list-url-state";
import { apiPost } from "@/lib/api-client";
import { formatPhoneForDisplay } from "@/lib/format";
import type { ContactResponse } from "@growspark/shared";

const ANY = "ANY";

export function ContactsPageClient() {
  const { searchParams, page, pageSize, setParams } = useListUrlState();
  const queryClient = useQueryClient();

  const q = searchParams.get("q") ?? "";
  const archived = searchParams.get("archived") === "true";
  const ownerId = searchParams.get("ownerId") ?? undefined;
  const sortField = searchParams.get("sort")?.split(":")[0] ?? "createdAt";
  const sortDirection = (searchParams.get("sort")?.split(":")[1] as "asc" | "desc" | undefined) ?? "desc";

  const listQuery = useContactsList({
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

  async function archiveContact(contact: ContactResponse) {
    await apiPost(`/api/v1/contacts/${contact.id}/archive`);
    toast.success(`${contact.firstName} was archived.`);
    void queryClient.invalidateQueries({ queryKey: [CONTACTS_QUERY_KEY_ROOT] });
  }

  async function restoreContact(contact: ContactResponse) {
    await apiPost(`/api/v1/contacts/${contact.id}/restore`);
    toast.success(`${contact.firstName} was restored.`);
    void queryClient.invalidateQueries({ queryKey: [CONTACTS_QUERY_KEY_ROOT] });
  }

  const columns: DataTableColumn<ContactResponse>[] = [
    {
      key: "firstName",
      header: "Name",
      sortable: true,
      render: (contact) => (
        <Link href={`/contacts/${contact.id}`} className="body-strong text-ink hover:underline">
          {contact.firstName} {contact.lastName}
        </Link>
      ),
    },
    {
      key: "jobTitle",
      header: "Job title",
      render: (contact) => <span className="text-ink-muted">{contact.jobTitle ?? "—"}</span>,
    },
    {
      key: "email",
      header: "Email",
      render: (contact) => <span className="text-ink-muted">{contact.email ?? "—"}</span>,
    },
    {
      key: "phone",
      header: "Phone",
      render: (contact) => <span className="text-ink-muted">{formatPhoneForDisplay(contact.phone) ?? "—"}</span>,
    },
    {
      key: "owner",
      header: "Owner",
      render: (contact) => (
        <span className="text-ink-muted">{contact.ownerId ? (ownerNames.get(contact.ownerId) ?? "—") : "—"}</span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (contact) => (
        <div className="flex justify-end gap-2">
          <ContactFormDialog
            contact={contact}
            trigger={
              <Button variant="ghost" size="icon-sm" aria-label={`Edit ${contact.firstName}`}>
                <Pencil className="size-4" aria-hidden="true" />
              </Button>
            }
          />
          {contact.archivedAt ? (
            <ConfirmActionDialog
              triggerLabel="Restore"
              title="Restore contact"
              description={`${contact.firstName} will reappear in the active contacts list.`}
              confirmLabel="Restore"
              onConfirm={() => restoreContact(contact)}
            />
          ) : (
            <ConfirmActionDialog
              triggerLabel="Archive"
              title="Archive contact"
              description={`${contact.firstName} will be hidden from the active contacts list. You can restore it later.`}
              confirmLabel="Archive"
              destructive
              onConfirm={() => archiveContact(contact)}
            />
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ContactFormDialog trigger={<Button>Add contact</Button>} />
      </div>

      <DataTable
        columns={columns}
        rows={listQuery.data?.data ?? []}
        rowKey={(contact) => contact.id}
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
        emptyTitle={archived ? "No archived contacts" : "No contacts yet"}
        emptyDescription={
          archived ? "Contacts you archive will appear here." : "Add your first contact to start tracking people."
        }
        emptyAction={!archived && <ContactFormDialog trigger={<Button size="sm">Add contact</Button>} />}
        filterBar={
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput
              value={q}
              onValueChange={(value) => setParams({ q: value || undefined })}
              onSearch={(value) => setParams({ q: value || undefined })}
              placeholder="Search name, email or phone"
              aria-label="Search contacts"
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
                <SelectItem value={ANY}>Active contacts</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      />
    </div>
  );
}
