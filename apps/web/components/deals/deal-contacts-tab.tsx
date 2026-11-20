"use client";

import { useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Star, X } from "lucide-react";
import type { DealResponse } from "@growspark/shared";
import { apiPut, ApiError } from "@/lib/api-client";
import { DEALS_QUERY_KEY_ROOT } from "@/hooks/use-deals";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ContactSelect } from "@/components/pickers/contact-select";

/**
 * The deal's own `contacts` summary (package 3.3's addition to
 * dealResponseSchema) is already on the `deal` object — no second request
 * just to list what PUT /deals/:id/contacts would otherwise only return
 * after a write.
 */
export function DealContactsTab({ deal }: { deal: DealResponse }) {
  const queryClient = useQueryClient();
  const [picking, setPicking] = useState(false);
  const [pendingNew, setPendingNew] = useState<{ id: string; name: string } | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // D47: a closed deal is read-only except for reopen — contact changes
  // are blocked the same way stage/field changes are.
  const closed = deal.status !== "OPEN";

  async function replaceContacts(contactIds: string[], primaryContactId: string | undefined) {
    setPending(true);
    setError(null);
    try {
      await apiPut(`/api/v1/deals/${deal.id}/contacts`, { contactIds, primaryContactId });
      void queryClient.invalidateQueries({ queryKey: [DEALS_QUERY_KEY_ROOT] });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update contacts. Please try again.");
    } finally {
      setPending(false);
    }
  }

  async function addContact() {
    if (!pendingNew) return;
    const currentPrimary = deal.contacts.find((contact) => contact.isPrimary)?.contactId;
    await replaceContacts([...deal.contacts.map((contact) => contact.contactId), pendingNew.id], currentPrimary ?? pendingNew.id);
    setPendingNew(undefined);
    setPicking(false);
  }

  async function removeContact(contactId: string) {
    const remaining = deal.contacts.filter((contact) => contact.contactId !== contactId);
    const currentPrimary = remaining.find((contact) => contact.isPrimary)?.contactId;
    await replaceContacts(
      remaining.map((contact) => contact.contactId),
      currentPrimary ?? remaining[0]?.contactId,
    );
  }

  async function makePrimary(contactId: string) {
    await replaceContacts(
      deal.contacts.map((contact) => contact.contactId),
      contactId,
    );
  }

  return (
    <div className="space-y-4">
      {!closed && (
        <div className="flex justify-end">
          {picking ? (
            <div className="flex items-center gap-2">
              <ContactSelect
                value={pendingNew}
                onValueChange={setPendingNew}
                companyId={deal.companyId}
                className="w-64"
                aria-label="Find a contact to add"
              />
              <Button size="sm" onClick={addContact} disabled={!pendingNew || pending}>
                Add
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setPicking(false);
                  setPendingNew(undefined);
                }}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button size="sm" onClick={() => setPicking(true)}>
              <Plus className="size-(--icon-md)" aria-hidden="true" />
              Add contact
            </Button>
          )}
        </div>
      )}

      {closed && (
        <p className="small text-ink-muted">This deal is closed, so its contacts cannot be changed. Reopen it first.</p>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {deal.contacts.length === 0 ? (
        <p className="text-ink-muted">No contacts linked to this deal yet.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-line">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Primary</TableHead>
                {!closed && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {deal.contacts.map((contact) => (
                <TableRow key={contact.contactId}>
                  <TableCell>
                    <Link href={`/contacts/${contact.contactId}`} className="body-strong text-ink hover:underline">
                      {contact.contactName}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {contact.isPrimary ? (
                      <Badge variant="accent">Primary</Badge>
                    ) : !closed ? (
                      <Button variant="ghost" size="sm" onClick={() => makePrimary(contact.contactId)} disabled={pending}>
                        <Star className="size-4" aria-hidden="true" />
                        Make primary
                      </Button>
                    ) : null}
                  </TableCell>
                  {!closed && (
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove ${contact.contactName}`}
                        onClick={() => removeContact(contact.contactId)}
                        disabled={pending}
                      >
                        <X className="size-4" aria-hidden="true" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
