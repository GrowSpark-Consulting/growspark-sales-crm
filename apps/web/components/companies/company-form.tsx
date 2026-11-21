"use client";

import { useLayoutEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { createCompanySchema, type CreateCompanyInput, type CompanyResponse } from "@growspark/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { OwnerSelect } from "@/components/pickers/owner-select";
import { stripEmptyOptionalFields } from "@/lib/form-utils";
import { apiGet } from "@/lib/api-client";
import { handleApiFormError } from "@/lib/handle-form-error";
import type { CompaniesListResult } from "@/hooks/use-companies";

/**
 * `createCompanySchema`'s `annualRevenue` is `z.coerce.number()` — correct
 * for the API (a direct JSON caller might send a numeric string), but
 * `z.coerce.number()`'s *input* type is `unknown` (Zod v4: it accepts
 * anything coercible), which makes the schema's pre-validation shape
 * diverge from `CreateCompanyInput` and breaks a plain `useForm<
 * CreateCompanyInput>`. The form never holds a raw string for this field —
 * the Input's own onChange already converts to a real number via
 * `valueAsNumber` — so the form's own resolver schema overrides just this
 * one field with a plain (non-coercing) validator, keeping every other
 * field's validator identical to the shared schema.
 */
const companyFormSchema = createCompanySchema.extend({
  annualRevenue: z.union([z.number().nonnegative("Annual revenue cannot be negative"), z.string().regex(/^\d+(\.\d{1,2})?$/, "Enter a valid amount")]).optional(),
});

/** Exported so a test can assert the cleanup's reset target is genuinely blank (D42). */
export function companyToFormValues(company?: CompanyResponse): CreateCompanyInput {
  return {
    name: company?.name ?? "",
    legalName: company?.legalName ?? "",
    industry: company?.industry ?? "",
    website: company?.website ?? "",
    email: company?.email ?? "",
    phone: company?.phone ?? "",
    employeeSize: company?.employeeSize ?? "",
    annualRevenue: company?.annualRevenue ?? undefined,
    addressLine1: company?.addressLine1 ?? "",
    addressLine2: company?.addressLine2 ?? "",
    city: company?.city ?? "",
    state: company?.state ?? "",
    postalCode: company?.postalCode ?? "",
    country: company?.country ?? "",
    ownerId: company?.ownerId ?? undefined,
    description: company?.description ?? "",
  };
}

export interface CompanyFormProps {
  /** Present in edit mode; omitted when creating. Both modes validate against
   * createCompanySchema (name required) — editing a company down to a blank
   * name isn't valid either, and this avoids a second, nearly-identical
   * schema just for the "all fields optional" shape PATCH otherwise allows. */
  company?: CompanyResponse;
  onSubmit: (values: CreateCompanyInput) => Promise<unknown>;
  submitLabel: string;
  pendingLabel: string;
  onCancel: () => void;
}

// D40: the non-core fields collapsed under "More details" — everything on
// CompanyResponse that isn't shown in the core section above.
const MORE_DETAILS_FIELDS = [
  "legalName",
  "employeeSize",
  "annualRevenue",
  "addressLine1",
  "addressLine2",
  "city",
  "state",
  "postalCode",
  "country",
  "description",
] as const satisfies readonly (keyof CompanyResponse)[];

function hasMoreDetailsValues(company: CompanyResponse | undefined): boolean {
  if (!company) return false;
  return MORE_DETAILS_FIELDS.some((field) => Boolean(company[field]));
}

export function CompanyForm({ company, onSubmit, submitLabel, pendingLabel, onCancel }: CompanyFormProps) {
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [duplicates, setDuplicates] = useState<{ id: string; name: string }[]>([]);

  const form = useForm<CreateCompanyInput>({
    resolver: zodResolver(companyFormSchema),
    defaultValues: companyToFormValues(company),
  });

  // D42: see the identical comment in lead-form.tsx — with cacheComponents
  // enabled, Next.js hides a navigated-away-from page with React's Activity
  // instead of unmounting it, so form state persists across a revisit unless
  // explicitly reset. Effect cleanup still fires on hide, exactly like a real
  // unmount, so this resets the *create* form (no `company` prop) to blank
  // every time, regardless of why the user left.
  useLayoutEffect(() => {
    if (company) return;
    return () => {
      form.reset(companyToFormValues());
      setDuplicates([]);
      setBannerError(null);
    };
  }, [company, form]);

  /**
   * D29: duplicates warn, never block. There is no standalone duplicate-check
   * endpoint for Companies (unlike Leads' GET /leads/duplicates, D35) — this
   * reuses the ordinary list endpoint's `q` search as a live, approximate
   * hint. It is not the same normalised-exact match the API performs on
   * save (that one still runs server-side and is authoritative); this is
   * just an early warning so the user can check before submitting.
   */
  async function checkDuplicateName(name: string) {
    const trimmed = name.trim();
    if (!trimmed) {
      setDuplicates([]);
      return;
    }
    try {
      const result = await apiGet<CompaniesListResult>(
        `/api/v1/companies?q=${encodeURIComponent(trimmed)}&pageSize=5`,
      );
      setDuplicates(result.data.filter((match) => match.id !== company?.id).map((match) => ({ id: match.id, name: match.name })));
    } catch {
      // A failed live check is not worth surfacing — the authoritative
      // server-side check still runs on submit either way.
    }
  }

  async function handleSubmit(values: CreateCompanyInput) {
    setBannerError(null);
    setSubmitting(true);
    try {
      await onSubmit(stripEmptyOptionalFields(values));
    } catch (error) {
      setBannerError(handleApiFormError(error, form));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6" noValidate>
        {bannerError && (
          <Alert variant="destructive">
            <AlertDescription>{bannerError}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Company name *</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    onBlur={(event) => {
                      field.onBlur();
                      void checkDuplicateName(event.target.value);
                    }}
                  />
                </FormControl>
                <FormMessage />
                {duplicates.length > 0 && (
                  <Alert variant="warning">
                    <AlertDescription>
                      <strong>This might already exist.</strong> Saving will still work — check before you
                      create a duplicate:
                      <ul className="mt-1 list-inside list-disc">
                        {duplicates.map((match) => (
                          <li key={match.id}>
                            <Link href={`/companies/${match.id}`} className="underline" target="_blank">
                              {match.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="industry"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Industry</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="website"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Website</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. https://example.com" {...field} />
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
                <FormLabel>Business email</FormLabel>
                <FormControl>
                  <Input type="email" {...field} />
                </FormControl>
                <FormMessage />
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
        </div>

        <Collapsible defaultOpen={hasMoreDetailsValues(company)} className="space-y-4">
          <CollapsibleTrigger>More details</CollapsibleTrigger>
          <CollapsibleContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="legalName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Legal name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="employeeSize"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Employee size</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. 51-200" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="annualRevenue"
                render={({ field: { value, onChange, ...field } }) => (
                  <FormItem>
                    <FormLabel>Annual revenue</FormLabel>
                    <FormControl>
                      <NumericInput
                        placeholder="e.g. 5000000"
                        value={value ?? ""}
                        onValueChange={(next) => onChange(next === "" ? undefined : next)}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="addressLine1"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address line 1</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="addressLine2"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address line 2</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="state"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>State</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="postalCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Postal code</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Country</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea rows={4} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CollapsibleContent>
        </Collapsible>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? pendingLabel : submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
}
