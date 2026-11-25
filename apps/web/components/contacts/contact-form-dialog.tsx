"use client";

import { useLayoutEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  createContactSchema,
  type CreateContactInput,
  type ContactResponse,
  type DuplicateMatch,
} from "@growspark/shared";
import { apiPost, apiPatch } from "@/lib/api-client";
import { handleApiFormError } from "@/lib/handle-form-error";
import { stripEmptyOptionalFields } from "@/lib/form-utils";
import { CONTACTS_QUERY_KEY_ROOT } from "@/hooks/use-contacts";
import { useCompany } from "@/hooks/use-companies";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { OwnerSelect } from "@/components/pickers/owner-select";
import { CompanySelect } from "@/components/pickers/company-select";

/** Exported so a test can assert the cleanup's reset target is genuinely blank (D42). */
export function contactToFormValues(contact: ContactResponse | undefined, lockedCompanyId: string | undefined): CreateContactInput {
  return {
    companyId: lockedCompanyId ?? contact?.companyId ?? "",
    firstName: contact?.firstName ?? "",
    lastName: contact?.lastName ?? "",
    email: contact?.email ?? "",
    phone: contact?.phone ?? "",
    jobTitle: contact?.jobTitle ?? "",
    department: contact?.department ?? "",
    location: contact?.location ?? "",
    ownerId: contact?.ownerId ?? undefined,
    notes: contact?.notes ?? "",
  };
}

export interface ContactFormDialogProps {
  /** Present in edit mode; omitted when creating. */
  contact?: ContactResponse;
  /** When set (e.g. launched from a Company's Contacts tab), the company field is pre-filled and locked. */
  lockedCompany?: { id: string; name: string };
  trigger: React.ReactNode;
}

/**
 * A Dialog, not a page, unlike Companies (D37 follow-up, package 2.5):
 * Contact has fewer fields and is launched from two different contexts
 * (standalone from /contacts, and "Add contact" on a Company's own
 * Contacts tab) — a dialog needs no navigation away from either.
 * `lifecycleStatus` is deliberately not a field here — see D36 (free
 * text, PRD never enumerates values, kept out of the UI).
 */
export function ContactFormDialog({ contact, lockedCompany, trigger }: ContactFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const isEdit = Boolean(contact);

  const form = useForm<CreateContactInput>({
    resolver: zodResolver(createContactSchema),
    defaultValues: contactToFormValues(contact, lockedCompany?.id),
  });

  // Only looked up to show the company's *name* in CompanySelect when
  // editing a contact that already has one (the form only stores the id).
  // Not needed when creating, or when the company is locked from context.
  const existingCompanyId = !lockedCompany ? contact?.companyId : undefined;
  const existingCompanyQuery = useCompany(existingCompanyId ?? undefined);

  const mutation = useMutation({
    mutationFn: (values: CreateContactInput) =>
      isEdit
        ? apiPatch<{ data: ContactResponse; duplicates: DuplicateMatch[] }>(
            `/api/v1/contacts/${contact!.id}`,
            values,
          )
        : apiPost<{ data: ContactResponse; duplicates: DuplicateMatch[] }>("/api/v1/contacts", values),
    onSuccess: (result) => {
      toast.success(`${result.data.firstName} ${result.data.lastName ?? ""}`.trim() + (isEdit ? " was updated." : " was added."));
      void queryClient.invalidateQueries({ queryKey: [CONTACTS_QUERY_KEY_ROOT] });
      setOpen(false);
      form.reset(contactToFormValues(undefined, lockedCompany?.id));
    },
    onError: (error) => {
      setBannerError(handleApiFormError(error, form));
    },
  });

  // D42: with cacheComponents enabled, Next.js hides a navigated-away-from
  // page with React's Activity instead of unmounting it, so an open dialog's
  // `open`/draft state survives and the dialog can reappear already-open
  // with stale values on a later revisit — effect cleanup still fires on
  // hide, exactly like a real unmount (Next.js's "Preserving UI state across
  // navigations" guide), so this forces the dialog closed and, when
  // creating, blanks the draft, every time the page is navigated away from.
  useLayoutEffect(() => {
    return () => {
      setOpen(false);
      if (!isEdit) {
        form.reset(contactToFormValues(undefined, lockedCompany?.id));
        setBannerError(null);
      }
    };
  }, [isEdit, lockedCompany?.id, form]);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setBannerError(null);
      form.reset(contactToFormValues(contact, lockedCompany?.id));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit contact" : "Add contact"}</DialogTitle>
          <DialogDescription>
            {lockedCompany ? `Linked to ${lockedCompany.name}.` : "Every contact belongs to a company."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) => {
              setBannerError(null);
              mutation.mutate(stripEmptyOptionalFields(values));
            })}
            className="space-y-4"
          >
            {bannerError && (
              <Alert variant="destructive">
                <AlertDescription>{bannerError}</AlertDescription>
              </Alert>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First name *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                    {!form.watch("email")?.trim() && !form.watch("phone")?.trim() && (
                      <p className="small text-ink-muted">Provide an email or a phone number.</p>
                    )}
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <PhoneInput value={field.value} onChange={field.onChange} onBlur={field.onBlur} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="jobTitle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Job title</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="department"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="ownerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Owner</FormLabel>
                    <FormControl>
                      <OwnerSelect value={field.value ?? undefined} onValueChange={field.onChange} className="w-full" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="companyId"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Company *</FormLabel>
                    <FormControl>
                      {lockedCompany ? (
                        <Input value={lockedCompany.name} disabled />
                      ) : existingCompanyId && existingCompanyQuery.isLoading ? (
                        <Input value="Loading…" disabled />
                      ) : (
                        <CompanySelect
                          value={
                            field.value
                              ? { id: field.value, name: existingCompanyQuery.data?.data.name ?? "" }
                              : undefined
                          }
                          onValueChange={(company) => field.onChange(company?.id ?? "")}
                        />
                      )}
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? (isEdit ? "Saving…" : "Adding…") : isEdit ? "Save changes" : "Add contact"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
