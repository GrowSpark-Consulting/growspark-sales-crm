"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ContactFormDialog } from "@/components/contacts/contact-form-dialog";
import { useContactsList } from "@/hooks/use-contacts";

/**
 * The Companies brief ("a company page shows its contacts and can add a
 * contact"): a bounded, unpaginated list scoped to this one company — not
 * the full DataTable (no search/sort/archived toggle/paging needed for
 * what's realistically a handful of contacts per company; the full
 * Contacts list at /contacts already covers that general case).
 */
export function CompanyContactsTab({ companyId, companyName }: { companyId: string; companyName: string }) {
  const contactsQuery = useContactsList({ companyId, pageSize: 50, sort: "firstName:asc" });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ContactFormDialog
          lockedCompany={{ id: companyId, name: companyName }}
          trigger={
            <Button size="sm">
              <Plus className="size-(--icon-md)" aria-hidden="true" />
              Add contact
            </Button>
          }
        />
      </div>

      {contactsQuery.isLoading && <Skeleton className="h-32 w-full" />}

      {contactsQuery.isError && (
        <Alert variant="destructive">
          <AlertDescription>Could not load this company&apos;s contacts.</AlertDescription>
        </Alert>
      )}

      {!contactsQuery.isLoading && !contactsQuery.isError && (contactsQuery.data?.data.length ?? 0) === 0 && (
        <p className="text-ink-muted">No contacts yet — add the first one for {companyName}.</p>
      )}

      {!contactsQuery.isLoading && !contactsQuery.isError && (contactsQuery.data?.data.length ?? 0) > 0 && (
        <div className="overflow-hidden rounded-lg border border-line">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Job title</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contactsQuery.data!.data.map((contact) => (
                <TableRow key={contact.id}>
                  <TableCell>
                    <Link href={`/contacts/${contact.id}`} className="body-strong text-ink hover:underline">
                      {contact.firstName} {contact.lastName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-ink-muted">{contact.jobTitle ?? "—"}</TableCell>
                  <TableCell className="text-ink-muted">{contact.email ?? "—"}</TableCell>
                  <TableCell className="text-ink-muted">{contact.phone ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
