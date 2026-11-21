"use client";

import Link from "next/link";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { apiPost, ApiError } from "@/lib/api-client";
import { CONTACTS_QUERY_KEY_ROOT, useContact } from "@/hooks/use-contacts";
import { useCompany } from "@/hooks/use-companies";
import { useUserOptions } from "@/hooks/use-user-options";
import { RecordLayout } from "@/components/ui/record-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatPhoneForDisplay } from "@/lib/format";
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog";
import { ContactFormDialog } from "@/components/contacts/contact-form-dialog";
import { DealsTab } from "@/components/deals/deals-tab";
import { RecordTimeline } from "@/components/activities/record-timeline";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="label text-ink-muted">{label}</p>
      <p className="body">{value ?? <span className="text-ink-muted">—</span>}</p>
    </div>
  );
}

export function ContactDetailPageClient({ contactId }: { contactId: string }) {
  const queryClient = useQueryClient();
  const contactQuery = useContact(contactId);
  const { data: userOptions } = useUserOptions();
  const contact = contactQuery.data?.data;
  const companyQuery = useCompany(contact?.companyId ?? undefined);

  async function archive() {
    await apiPost(`/api/v1/contacts/${contactId}/archive`);
    toast.success("Contact archived.");
    void queryClient.invalidateQueries({ queryKey: [CONTACTS_QUERY_KEY_ROOT] });
  }

  async function restore() {
    await apiPost(`/api/v1/contacts/${contactId}/restore`);
    toast.success("Contact restored.");
    void queryClient.invalidateQueries({ queryKey: [CONTACTS_QUERY_KEY_ROOT] });
  }

  if (contactQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (contactQuery.isError || !contact) {
    const notFound = contactQuery.error instanceof ApiError && contactQuery.error.status === 404;
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {notFound ? "This contact does not exist, or was deleted." : "Could not load this contact."}
        </AlertDescription>
      </Alert>
    );
  }

  const ownerName = userOptions?.data.find((u) => u.id === contact.ownerId)?.name;
  const companyName = companyQuery.data?.data.name;
  const fullName = `${contact.firstName} ${contact.lastName ?? ""}`.trim();

  return (
    <RecordLayout
      title={fullName}
      statusBadge={contact.archivedAt ? <Badge variant="danger">Archived</Badge> : undefined}
      actions={
        <>
          <ContactFormDialog
            contact={contact}
            trigger={
              <Button variant="outline" size="sm">
                <Pencil className="size-(--icon-md)" aria-hidden="true" />
                Edit
              </Button>
            }
          />
          {contact.archivedAt ? (
            <ConfirmActionDialog
              triggerLabel="Restore"
              title="Restore contact"
              description={`${fullName} will reappear in the active contacts list.`}
              confirmLabel="Restore"
              onConfirm={restore}
            />
          ) : (
            <ConfirmActionDialog
              triggerLabel="Archive"
              title="Archive contact"
              description={`${fullName} will be hidden from the active contacts list. You can restore it later.`}
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
          value: contact.companyId ? (
            <Link href={`/companies/${contact.companyId}`} className="text-primary underline">
              {companyName ?? "…"}
            </Link>
          ) : (
            "—"
          ),
        },
        { label: "Job title", value: contact.jobTitle },
        { label: "Phone", value: formatPhoneForDisplay(contact.phone) },
        { label: "Email", value: contact.email },
        { label: "Owner", value: ownerName ?? "Unassigned" },
      ]}
      tabs={[
        {
          value: "overview",
          label: "Overview",
          content: (
            <div className="grid gap-4 rounded-lg border border-line bg-surface p-4 sm:grid-cols-2">
              <Field label="Department" value={contact.department} />
              <Field label="Location" value={contact.location} />
              <div className="sm:col-span-2">
                <Field label="Notes" value={contact.notes} />
              </div>
            </div>
          ),
        },
        {
          value: "deals",
          label: "Deals",
          content: <DealsTab contactId={contact.id} emptyLabel={`No deals yet for ${fullName}.`} />,
        },
        { value: "timeline", label: "Timeline", content: <RecordTimeline owner="contacts" recordId={contact.id} /> },
      ]}
    />
  );
}
