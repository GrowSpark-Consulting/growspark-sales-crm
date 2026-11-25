"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { updateOrganizationSchema, type OrganizationResponse, type UpdateOrganizationInput } from "@growspark/shared";
import { apiPatch } from "@/lib/api-client";
import { handleApiFormError } from "@/lib/handle-form-error";
import { SETTINGS_QUERY_KEY_ROOT, useOrganizationSettings, useRequireAdmin } from "@/hooks/use-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

type FormValues = z.input<typeof updateOrganizationSchema>;
type FieldName = keyof FormValues;

function toFormValues(org: OrganizationResponse): FormValues {
  return {
    name: org.name,
    legalName: org.legalName ?? "",
    addressLine1: org.addressLine1 ?? "",
    addressLine2: org.addressLine2 ?? "",
    city: org.city ?? "",
    state: org.state ?? "",
    postalCode: org.postalCode ?? "",
    country: org.country ?? "",
    phone: org.phone ?? "",
    email: org.email ?? "",
    website: org.website ?? "",
    gstin: org.gstin ?? "",
  };
}

const SECTIONS: { title: string; fields: { name: FieldName; label: string; required?: boolean; autoComplete?: string; wide?: boolean }[] }[] = [
  {
    title: "Organisation",
    fields: [
      { name: "name", label: "Display name", required: true, autoComplete: "organization" },
      { name: "legalName", label: "Legal name" },
      { name: "gstin", label: "GSTIN" },
    ],
  },
  {
    title: "Address",
    fields: [
      { name: "addressLine1", label: "Address line 1", autoComplete: "address-line1", wide: true },
      { name: "addressLine2", label: "Address line 2", autoComplete: "address-line2", wide: true },
      { name: "city", label: "City", autoComplete: "address-level2" },
      { name: "state", label: "State", autoComplete: "address-level1" },
      { name: "postalCode", label: "PIN / postal code", autoComplete: "postal-code" },
      { name: "country", label: "Country", autoComplete: "country-name" },
    ],
  },
  {
    title: "Contact details",
    fields: [
      { name: "phone", label: "Phone", autoComplete: "tel", wide: true },
      { name: "email", label: "Email", autoComplete: "email" },
      { name: "website", label: "Website", autoComplete: "url" },
    ],
  },
];

/** /settings/organization — Admin only. These details are printed in every quotation PDF header (D84). */
export function OrganizationSettingsPageClient() {
  const isAdmin = useRequireAdmin();
  const query = useOrganizationSettings(isAdmin);
  if (!isAdmin) return null;
  if (query.isLoading || !query.data) return <Skeleton className="h-96 w-full max-w-3xl" />;
  return <OrganizationForm org={query.data.data} />;
}

function OrganizationForm({ org }: { org: OrganizationResponse }) {
  const queryClient = useQueryClient();
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<FormValues, unknown, UpdateOrganizationInput>({
    resolver: zodResolver(updateOrganizationSchema),
    defaultValues: toFormValues(org),
  });

  useEffect(() => {
    form.reset(toFormValues(org));
  }, [org, form]);

  async function onSubmit(values: UpdateOrganizationInput) {
    setBannerError(null);
    setSubmitting(true);
    try {
      const result = await apiPatch<{ data: OrganizationResponse }>("/api/v1/settings/organization", values);
      queryClient.setQueryData([SETTINGS_QUERY_KEY_ROOT, "organization"], result);
      toast.success("Organisation details saved.");
    } catch (error) {
      setBannerError(handleApiFormError(error, form));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-3xl space-y-6" noValidate>
        <p className="text-sm text-ink-muted">
          Printed in the header of every quotation PDF. Blank fields are simply left off.
        </p>
        {bannerError && (
          <Alert variant="destructive">
            <AlertDescription>{bannerError}</AlertDescription>
          </Alert>
        )}
        {SECTIONS.map((section) => (
          <section key={section.title} className="space-y-3 rounded-lg border border-line bg-surface p-4">
            <h2 className="h3">{section.title}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {section.fields.map((field) => (
                <FormField
                  key={field.name}
                  control={form.control}
                  name={field.name}
                  render={({ field: input }) => (
                    <FormItem className={field.wide ? "sm:col-span-2" : undefined}>
                      <FormLabel>
                        {field.label}
                        {field.required ? " *" : ""}
                      </FormLabel>
                      <FormControl>
                        {field.name === "phone" ? (
                          // D99: the same phone input as every other form.
                          <PhoneInput value={input.value ?? ""} onChange={input.onChange} onBlur={input.onBlur} />
                        ) : (
                          <Input
                            {...input}
                            value={input.value ?? ""}
                            autoComplete={field.autoComplete}
                            className={field.name === "gstin" ? "uppercase" : undefined}
                          />
                        )}
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
            </div>
          </section>
        ))}
        <section className="space-y-2 rounded-lg border border-line bg-surface p-4">
          <h2 className="h3">Regional settings</h2>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-ink-muted">Currency</dt>
              <dd className="font-medium text-ink">{org.currency}</dd>
            </div>
            <div>
              <dt className="text-sm text-ink-muted">Time zone</dt>
              <dd className="font-medium text-ink">{org.timezone}</dd>
            </div>
          </dl>
          <p className="text-sm text-ink-muted">
            Fixed for now: changing them would shift the dates of existing reports and quotation numbers.
          </p>
        </section>
        <div className="flex justify-end">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
